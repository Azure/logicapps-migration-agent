/**
 * MuleSoft Flow Parser
 *
 * Parses MuleSoft Mule 4 XML flow files into IR format.
 * Handles flows, sub-flows, processors, connectors, error handlers,
 * and global configurations.
 *
 * @module parsers/mulesoft/MuleSoftFlowParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import {
    MuleApplicationInfo,
    MuleFlow,
    MuleSubFlow,
    MuleSource,
    MuleProcessor,
    MuleProcessorType,
    MuleElement,
    MuleGlobalConfig,
    MuleConnectionConfig,
    MuleErrorHandler,
    MuleErrorStrategy,
    MuleBranch,
    MuleDataWeaveContent,
    MULE_TO_LA_ACTION_MAP,
    MULE_SOURCE_TO_TRIGGER_MAP,
} from './types';
import {
    parseXml,
    getAttr,
    getAllChildElements,
    getAllElements,
    getChildElements,
} from '../utils/xml';
import {
    IRDocument,
    createEmptyIRDocument,
    IRTrigger,
    IRAction,
    IRConnection,
    IRVariable,
    IRGap,
    IRErrorHandlingConfig,
    ActionType,
    TriggerType,
    RunAfterConfig,
    ConnectionType,
    GapCategory,
    GapSeverity,
} from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// MuleSoft Flow Parser
// =============================================================================

/**
 * Parser for MuleSoft Mule 4 XML flow files.
 *
 * Mule 4 applications use XML configuration files that define:
 * - Flows: Executable units with a source (trigger) and a chain of processors
 * - Sub-flows: Reusable processor chains (no source)
 * - Global configurations: Connector configs, error handlers
 *
 * XML structure:
 * ```xml
 * <mule xmlns="http://www.mulesoft.org/schema/mule/core"
 *       xmlns:http="http://www.mulesoft.org/schema/mule/http"
 *       xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
 *   <http:listener-config name="...">...</http:listener-config>
 *   <flow name="main-flow">
 *     <http:listener config-ref="..." path="/api"/>
 *     <ee:transform>...</ee:transform>
 *     <choice>...</choice>
 *   </flow>
 *   <sub-flow name="helper">...</sub-flow>
 * </mule>
 * ```
 */
export class MuleSoftFlowParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'mulesoft',
        fileExtensions: ['.xml'],
        fileTypes: ['flow'],
        supportsFolder: false,
        description: 'Parses MuleSoft Mule 4 flow XML files into IR actions and triggers',
    };

    /** Counter for generating unique action IDs */
    private actionCounter = 0;

    // =========================================================================
    // canParse Override
    // =========================================================================

    override canParse(filePath: string): boolean {
        if (!filePath.toLowerCase().endsWith('.xml')) {
            return false;
        }

        // Check if this is a Mule XML file by examining the path or file name
        const fileName = path.basename(filePath).toLowerCase();
        const dirName = path.dirname(filePath).toLowerCase();

        // Exclude known MuleSoft metadata/project descriptor files that are not flows.
        // These are handled by MuleSoftProjectParser instead.
        const nonFlowFiles = [
            'mule-project.xml',
            'pom.xml',
            'mule-artifact.json',
            'mule-app.properties',
        ];
        if (nonFlowFiles.includes(fileName)) {
            return false;
        }

        // Standard Mule 4 project structure: src/main/mule/*.xml
        if (dirName.includes(path.join('src', 'main', 'mule').toLowerCase())) {
            return true;
        }

        // Mule 3 project structure: src/main/app/*.xml
        if (dirName.includes(path.join('src', 'main', 'app').toLowerCase())) {
            // Exclude property files
            if (!fileName.endsWith('.properties')) {
                return true;
            }
        }

        // Also detect by filename patterns
        if (
            fileName.includes('mule') ||
            fileName.includes('flow') ||
            fileName.includes('-api') ||
            fileName.includes('-impl')
        ) {
            return true;
        }

        return false;
    }

    // =========================================================================
    // AbstractParser Implementation
    // =========================================================================

    protected async doParse(
        inputPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        this.actionCounter = 0;

        this.reportProgress(
            options.onProgress,
            1,
            5,
            `Reading Mule flow: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Verify this is a Mule XML file
        if (!this.isMuleXml(content)) {
            errors.addError(
                ParseErrorCodes.UNSUPPORTED_FORMAT,
                'File does not appear to be a MuleSoft Mule XML configuration',
                { filePath: inputPath }
            );
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Flow file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 5, 'Parsing Mule application structure');

        // Parse Mule application structure
        const appInfo = this.parseMuleXml(doc, inputPath, errors);
        if (!appInfo) {
            return null;
        }

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 5, 'Extracting connections');

        // Extract connections from global configs
        const connections = this.extractConnections(appInfo.globalConfigs);

        this.reportProgress(options.onProgress, 4, 5, 'Converting to IR');

        // Convert to IR (one IR per flow, using first/main flow)
        const ir = this.convertToIR(appInfo, connections, inputPath, errors);

        this.reportProgress(options.onProgress, 5, 5, 'Flow parsing complete');

        return ir;
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'flow',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'flow',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const appInfo = this.parseMuleXml(doc, filePath, errors);

        if (!appInfo) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'flow',
            };
        }

        const totalProcessors = appInfo.flows.reduce((sum, f) => sum + f.processors.length, 0);

        return {
            name: appInfo.name,
            type: 'flow',
            elementCount: totalProcessors,
            references: [
                ...appInfo.flows.map((f) => f.name),
                ...appInfo.subFlows.map((sf) => sf.name),
            ],
            description: `${appInfo.flows.length} flow(s), ${appInfo.subFlows.length} sub-flow(s), ${totalProcessors} processors`,
        };
    }

    // =========================================================================
    // Mule XML Detection
    // =========================================================================

    /**
     * Check if content is a Mule XML file by looking for the Mule namespace.
     */
    private isMuleXml(content: string): boolean {
        return (
            content.includes('http://www.mulesoft.org/schema/mule/core') ||
            content.includes('mulesoft.org/schema/mule') ||
            content.includes('<mule ')
        );
    }

    // =========================================================================
    // Mule XML Parsing
    // =========================================================================

    /**
     * Parse the Mule XML document into structured MuleApplicationInfo.
     */
    private parseMuleXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): MuleApplicationInfo | null {
        const root = doc.documentElement;

        if (!root) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'XML document has no root element', {
                filePath,
            });
            return null;
        }

        // Extract XML namespaces
        const namespaces = this.extractNamespaces(root);

        // Parse global configurations
        const globalConfigs = this.parseGlobalConfigs(root, namespaces);

        // Parse flows
        const flows = this.parseFlows(root, namespaces, errors);

        // Parse sub-flows
        const subFlows = this.parseSubFlows(root, namespaces, errors);

        // Parse global error handler
        const globalErrorHandler = this.parseGlobalErrorHandler(root, namespaces);

        if (flows.length === 0 && subFlows.length === 0) {
            errors.addWarning(
                ParseErrorCodes.INVALID_FLOW,
                'No flows or sub-flows found in Mule XML file',
                { filePath }
            );
        }

        return {
            filePath,
            name: path.basename(filePath, '.xml'),
            flows,
            subFlows,
            globalConfigs,
            globalErrorHandler,
            namespaces,
        };
    }

    /**
     * Extract XML namespaces from the root element attributes.
     */
    private extractNamespaces(root: Element): Record<string, string> {
        const namespaces: Record<string, string> = {};

        if (root.attributes) {
            for (const attr of Array.from(root.attributes)) {
                if (attr && attr.name.startsWith('xmlns:')) {
                    const prefix = attr.name.substring(6);
                    namespaces[prefix] = attr.value;
                } else if (attr && attr.name === 'xmlns') {
                    namespaces[''] = attr.value;
                }
            }
        }

        return namespaces;
    }

    // =========================================================================
    // Global Config Parsing
    // =========================================================================

    /**
     * Parse global connector configurations.
     */
    private parseGlobalConfigs(
        root: Element,
        _namespaces: Record<string, string>
    ): MuleGlobalConfig[] {
        const configs: MuleGlobalConfig[] = [];
        const children = getAllChildElements(root);

        for (const child of children) {
            const tagName = child.tagName;

            // Global configs typically end with '-config' (http:listener-config, db:config, etc.)
            if (tagName.includes('-config') || tagName.endsWith(':config')) {
                const name = getAttr(child, 'name') || '';
                const [ns] = this.splitQualifiedName(tagName);

                // Find connection sub-element
                const connection = this.parseConnectionConfig(child);

                configs.push({
                    type: tagName,
                    name,
                    namespace: ns,
                    attributes: this.getElementAttributes(child),
                    connection,
                    children: this.parseChildElements(child),
                });
            }
        }

        return configs;
    }

    /**
     * Parse connection sub-element from a config element.
     */
    private parseConnectionConfig(configElement: Element): MuleConnectionConfig | undefined {
        const children = getAllChildElements(configElement);

        for (const child of children) {
            const tagName = child.tagName;
            // Connection elements typically contain 'connection' in the name
            if (tagName.includes('connection') || tagName.includes('Connection')) {
                return {
                    type: tagName,
                    attributes: this.getElementAttributes(child),
                    children: this.parseChildElements(child),
                };
            }
        }

        return undefined;
    }

    // =========================================================================
    // Flow Parsing
    // =========================================================================

    /**
     * Parse all <flow> elements.
     */
    private parseFlows(
        root: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleFlow[] {
        const flows: MuleFlow[] = [];
        const flowElements = getChildElements(root, 'flow');

        for (const flowEl of flowElements) {
            const flow = this.parseFlow(flowEl, namespaces, errors);
            if (flow) {
                flows.push(flow);
            }
        }

        return flows;
    }

    /**
     * Parse a single <flow> element.
     */
    private parseFlow(
        flowEl: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleFlow | null {
        const name = getAttr(flowEl, 'name') || 'unnamed-flow';
        const maxConcurrency = getAttr(flowEl, 'maxConcurrency');
        const initialState = getAttr(flowEl, 'initialState');

        const children = getAllChildElements(flowEl);
        let source: MuleSource | undefined;
        const processors: MuleProcessor[] = [];
        let errorHandler: MuleErrorHandler | undefined;

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (!child) {
                continue;
            }
            const tagName = child.tagName;

            if (tagName === 'error-handler') {
                errorHandler = this.parseErrorHandler(child, namespaces, errors);
            } else if (i === 0 && this.isSourceElement(tagName)) {
                // First element in a flow is the source/trigger
                source = this.parseSource(child, namespaces);
            } else {
                const processor = this.parseProcessor(child, namespaces, errors);
                if (processor) {
                    processors.push(processor);
                }
            }
        }

        return {
            name,
            source,
            processors,
            errorHandler,
            maxConcurrency: maxConcurrency ? parseInt(maxConcurrency, 10) : undefined,
            initialState,
        };
    }

    /**
     * Parse all <sub-flow> elements.
     */
    private parseSubFlows(
        root: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleSubFlow[] {
        const subFlows: MuleSubFlow[] = [];
        const subFlowElements = getChildElements(root, 'sub-flow');

        for (const el of subFlowElements) {
            const name = getAttr(el, 'name') || 'unnamed-sub-flow';
            const processors: MuleProcessor[] = [];
            const children = getAllChildElements(el);

            for (const child of children) {
                const processor = this.parseProcessor(child, namespaces, errors);
                if (processor) {
                    processors.push(processor);
                }
            }

            subFlows.push({ name, processors });
        }

        return subFlows;
    }

    // =========================================================================
    // Source (Trigger) Parsing
    // =========================================================================

    /**
     * Check if an element is a source (trigger) type.
     */
    private isSourceElement(tagName: string): boolean {
        const sourceElements = [
            'http:listener',
            'jms:listener',
            'vm:listener',
            'scheduler',
            'file:listener',
            'ftp:listener',
            'sftp:listener',
            'email:listener-imap',
            'email:listener-pop3',
            'db:listener',
        ];
        return sourceElements.includes(tagName);
    }

    /**
     * Parse a source (trigger) element.
     */
    private parseSource(element: Element, _namespaces: Record<string, string>): MuleSource {
        const tagName = element.tagName;
        const [ns, sourceName] = this.splitQualifiedName(tagName);

        return {
            type: tagName,
            namespace: ns,
            localName: sourceName,
            configRef: getAttr(element, 'config-ref'),
            attributes: this.getElementAttributes(element),
            children: this.parseChildElements(element),
        };
    }

    // =========================================================================
    // Processor Parsing
    // =========================================================================

    /**
     * Parse a processor element recursively.
     */
    private parseProcessor(
        element: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor | null {
        const tagName = element.tagName;
        const [ns, localName] = this.splitQualifiedName(tagName);
        const docName = getAttr(element, 'doc:name') || getAttr(element, 'doc:id') || undefined;
        const configRef = getAttr(element, 'config-ref');
        const processorType = this.classifyProcessor(tagName);

        const baseProcessor: MuleProcessor = {
            type: processorType,
            qualifiedName: tagName,
            namespace: ns,
            localName,
            docName,
            configRef,
            attributes: this.getElementAttributes(element),
            children: this.parseChildElements(element),
        };

        // Handle container-type processors with nested content
        switch (processorType) {
            case 'choice':
                return this.parseChoiceProcessor(element, baseProcessor, namespaces, errors);
            case 'scatter-gather':
                return this.parseScatterGatherProcessor(element, baseProcessor, namespaces, errors);
            case 'foreach':
                return this.parseForEachProcessor(element, baseProcessor, namespaces, errors);
            case 'until-successful':
                return this.parseUntilSuccessfulProcessor(
                    element,
                    baseProcessor,
                    namespaces,
                    errors
                );
            case 'try':
                return this.parseTryProcessor(element, baseProcessor, namespaces, errors);
            case 'ee:transform':
                return this.parseTransformProcessor(element, baseProcessor);
            default:
                return baseProcessor;
        }
    }

    /**
     * Parse a <choice> (conditional routing) processor.
     */
    private parseChoiceProcessor(
        element: Element,
        base: MuleProcessor,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor {
        const branches: MuleBranch[] = [];
        const children = getAllChildElements(element);

        for (const child of children) {
            if (child.tagName === 'when') {
                const expression = getAttr(child, 'expression') || '';
                const processors = this.parseProcessorChildren(child, namespaces, errors);
                branches.push({ expression, isDefault: false, processors });
            } else if (child.tagName === 'otherwise') {
                const processors = this.parseProcessorChildren(child, namespaces, errors);
                branches.push({ isDefault: true, processors });
            }
        }

        return { ...base, branches };
    }

    /**
     * Parse a <scatter-gather> (parallel execution) processor.
     */
    private parseScatterGatherProcessor(
        element: Element,
        base: MuleProcessor,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor {
        const branches: MuleBranch[] = [];
        const children = getAllChildElements(element);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child && child.tagName === 'route') {
                const processors = this.parseProcessorChildren(child, namespaces, errors);
                branches.push({ label: `route-${i}`, processors });
            }
        }

        return { ...base, branches };
    }

    /**
     * Parse a <foreach> processor.
     */
    private parseForEachProcessor(
        element: Element,
        base: MuleProcessor,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor {
        const collection = getAttr(element, 'collection') || '#[payload]';
        const nestedProcessors = this.parseProcessorChildren(element, namespaces, errors);

        return { ...base, collection, nestedProcessors };
    }

    /**
     * Parse an <until-successful> processor.
     */
    private parseUntilSuccessfulProcessor(
        element: Element,
        base: MuleProcessor,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor {
        const nestedProcessors = this.parseProcessorChildren(element, namespaces, errors);
        return { ...base, nestedProcessors };
    }

    /**
     * Parse a <try> scope processor.
     */
    private parseTryProcessor(
        element: Element,
        base: MuleProcessor,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor {
        const nestedProcessors: MuleProcessor[] = [];
        let errorHandler: MuleErrorHandler | undefined;
        const children = getAllChildElements(element);

        for (const child of children) {
            if (child.tagName === 'error-handler') {
                errorHandler = this.parseErrorHandler(child, namespaces, errors);
            } else {
                const processor = this.parseProcessor(child, namespaces, errors);
                if (processor) {
                    nestedProcessors.push(processor);
                }
            }
        }

        return { ...base, nestedProcessors, errorHandler };
    }

    /**
     * Parse an <ee:transform> DataWeave processor.
     */
    private parseTransformProcessor(element: Element, base: MuleProcessor): MuleProcessor {
        const dataweaveContent: MuleDataWeaveContent = {
            setPayload: this.extractDataWeavePayload(element),
            setVariables: this.extractDataWeaveVariables(element),
            setAttributes: this.extractDataWeaveAttributes(element),
        };

        return { ...base, dataweaveContent };
    }

    /**
     * Extract DataWeave payload script from ee:transform.
     */
    private extractDataWeavePayload(transformEl: Element): string | undefined {
        // Structure: <ee:message><ee:set-payload>script</ee:set-payload></ee:message>
        const messageEls = getAllElements(transformEl, 'ee:message');
        if (messageEls.length > 0 && messageEls[0]) {
            const setPayloadEls = getAllElements(messageEls[0], 'ee:set-payload');
            if (setPayloadEls.length > 0 && setPayloadEls[0]) {
                return setPayloadEls[0].textContent?.trim() || undefined;
            }
        }
        return undefined;
    }

    /**
     * Extract DataWeave variable scripts from ee:transform.
     */
    private extractDataWeaveVariables(transformEl: Element): Record<string, string> | undefined {
        const variables: Record<string, string> = {};
        const varEls = getAllElements(transformEl, 'ee:set-variable');

        for (const el of varEls) {
            const varName = getAttr(el, 'variableName');
            const script = el.textContent?.trim();
            if (varName && script) {
                variables[varName] = script;
            }
        }

        return Object.keys(variables).length > 0 ? variables : undefined;
    }

    /**
     * Extract DataWeave attributes script from ee:transform.
     */
    private extractDataWeaveAttributes(transformEl: Element): string | undefined {
        const setAttrEls = getAllElements(transformEl, 'ee:set-attributes');
        if (setAttrEls.length > 0 && setAttrEls[0]) {
            return setAttrEls[0].textContent?.trim() || undefined;
        }
        return undefined;
    }

    /**
     * Parse child processors of a container element.
     */
    private parseProcessorChildren(
        container: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleProcessor[] {
        const processors: MuleProcessor[] = [];
        const children = getAllChildElements(container);

        for (const child of children) {
            // Skip non-processor elements
            if (child.tagName === 'error-handler') {
                continue;
            }

            const processor = this.parseProcessor(child, namespaces, errors);
            if (processor) {
                processors.push(processor);
            }
        }

        return processors;
    }

    // =========================================================================
    // Error Handler Parsing
    // =========================================================================

    /**
     * Parse an <error-handler> element.
     */
    private parseErrorHandler(
        element: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleErrorHandler {
        const strategies: MuleErrorStrategy[] = [];
        const children = getAllChildElements(element);

        for (const child of children) {
            if (child.tagName === 'on-error-propagate' || child.tagName === 'on-error-continue') {
                strategies.push(this.parseErrorStrategy(child, namespaces, errors));
            }
        }

        return { strategies };
    }

    /**
     * Parse a global error handler at the <mule> root level.
     */
    private parseGlobalErrorHandler(
        root: Element,
        namespaces: Record<string, string>
    ): MuleErrorHandler | undefined {
        const errorHandlerEls = getChildElements(root, 'error-handler');
        if (errorHandlerEls.length > 0 && errorHandlerEls[0]) {
            const errors = new ParseErrorAccumulator(100);
            return this.parseErrorHandler(errorHandlerEls[0], namespaces, errors);
        }
        return undefined;
    }

    /**
     * Parse an on-error-propagate or on-error-continue element.
     */
    private parseErrorStrategy(
        element: Element,
        namespaces: Record<string, string>,
        errors: ParseErrorAccumulator
    ): MuleErrorStrategy {
        const type = element.tagName as 'on-error-propagate' | 'on-error-continue';
        const errorType = getAttr(element, 'type');
        const when = getAttr(element, 'when');
        const logException = getAttr(element, 'logException') !== 'false';
        const enableNotifications = getAttr(element, 'enableNotifications') !== 'false';

        const processors = this.parseProcessorChildren(element, namespaces, errors);

        return {
            type,
            errorType,
            when,
            logException,
            enableNotifications,
            processors,
        };
    }

    // =========================================================================
    // Processor Classification
    // =========================================================================

    /**
     * Classify a processor element by its qualified tag name.
     */
    private classifyProcessor(tagName: string): MuleProcessorType {
        // Direct match lookup
        const knownTypes: Record<string, MuleProcessorType> = {
            logger: 'logger',
            'set-payload': 'set-payload',
            'set-variable': 'set-variable',
            'remove-variable': 'remove-variable',
            'flow-ref': 'flow-ref',
            'raise-error': 'raise-error',
            'parse-template': 'parse-template',
            'ee:transform': 'ee:transform',
            choice: 'choice',
            'scatter-gather': 'scatter-gather',
            foreach: 'foreach',
            'until-successful': 'until-successful',
            'first-successful': 'first-successful',
            'round-robin': 'round-robin',
            try: 'try',
            'http:request': 'http:request',
            'db:select': 'db:select',
            'db:insert': 'db:insert',
            'db:update': 'db:update',
            'db:delete': 'db:delete',
            'db:stored-procedure': 'db:stored-procedure',
            'db:bulk-insert': 'db:bulk-insert',
            'db:bulk-update': 'db:bulk-update',
            'db:bulk-delete': 'db:bulk-delete',
            'file:read': 'file:read',
            'file:write': 'file:write',
            'file:copy': 'file:copy',
            'file:move': 'file:move',
            'file:delete': 'file:delete',
            'file:list': 'file:list',
            'ftp:read': 'ftp:read',
            'ftp:write': 'ftp:write',
            'ftp:copy': 'ftp:copy',
            'ftp:move': 'ftp:move',
            'ftp:delete': 'ftp:delete',
            'ftp:list': 'ftp:list',
            'sftp:read': 'sftp:read',
            'sftp:write': 'sftp:write',
            'sftp:copy': 'sftp:copy',
            'sftp:move': 'sftp:move',
            'sftp:delete': 'sftp:delete',
            'sftp:list': 'sftp:list',
            'jms:publish': 'jms:publish',
            'jms:consume': 'jms:consume',
            'jms:publish-consume': 'jms:publish-consume',
            'vm:publish': 'vm:publish',
            'vm:consume': 'vm:consume',
            'vm:publish-consume': 'vm:publish-consume',
            'wsc:consume': 'wsc:consume',
            'os:store': 'os:store',
            'os:retrieve': 'os:retrieve',
            'os:contains': 'os:contains',
            'os:remove': 'os:remove',
            'email:send': 'email:send',
            'validation:is-true': 'validation:is-true',
            'validation:is-false': 'validation:is-false',
            'validation:is-not-null': 'validation:is-not-null',
            'validation:is-null': 'validation:is-null',
            'validation:validates-size': 'validation:validates-size',
            'validation:is-not-blank-string': 'validation:is-not-blank-string',
            'validation:matches-regex': 'validation:matches-regex',
            'validation:is-email': 'validation:is-email',
            'sap:sync-rfc': 'sap:sync-rfc',
            'sap:async-rfc': 'sap:async-rfc',
            'sap:send-idoc': 'sap:send-idoc',
            'salesforce:create': 'salesforce:create',
            'salesforce:update': 'salesforce:update',
            'salesforce:query': 'salesforce:query',
            'salesforce:delete': 'salesforce:delete',
            'salesforce:upsert': 'salesforce:upsert',
        };

        return knownTypes[tagName] || 'unknown';
    }

    // =========================================================================
    // Connection Extraction
    // =========================================================================

    /**
     * Extract IR connections from global configs.
     */
    private extractConnections(globalConfigs: readonly MuleGlobalConfig[]): IRConnection[] {
        const connections: IRConnection[] = [];

        for (const config of globalConfigs) {
            const connection = this.globalConfigToConnection(config);
            if (connection) {
                connections.push(connection);
            }
        }

        return connections;
    }

    /**
     * Convert a global config to an IRConnection.
     */
    private globalConfigToConnection(config: MuleGlobalConfig): IRConnection | null {
        const connAttrs = config.connection?.attributes || {};

        // Determine connection type from config type
        const { connectionType, category } = this.classifyConnection(config.type);
        if (!connectionType) {
            return null;
        }

        const host = connAttrs['host'] || connAttrs['url'] || '';
        const port = connAttrs['port'] ? parseInt(connAttrs['port'], 10) : undefined;
        const protocol = connAttrs['protocol'] || '';

        return {
            id: `conn-${config.name}`,
            name: config.name,
            type: connectionType,
            category: category as IRConnection['category'],
            config: {
                baseUrl:
                    host && port ? `${protocol.toLowerCase() || 'https'}://${host}:${port}` : host,
                authentication: this.extractAuthConfig(config),
            } as Record<string, unknown>,
            sourceMapping: {
                mulesoft: {
                    connector: config.type,
                    name: config.name,
                    ...connAttrs,
                },
            },
            targetMapping: {
                gap: false,
            },
        } as unknown as IRConnection;
    }

    /**
     * Classify a global config type into a connection type and category.
     */
    private classifyConnection(configType: string): {
        connectionType: ConnectionType | null;
        category: string;
    } {
        if (configType.startsWith('http:listener-config')) {
            return { connectionType: 'http', category: 'api' };
        }
        if (configType.startsWith('http:request-config')) {
            return { connectionType: 'http', category: 'api' };
        }
        if (configType.startsWith('db:')) {
            // Check sub-type for specific DB
            return { connectionType: 'sql-server', category: 'database' };
        }
        if (configType.startsWith('jms:')) {
            return { connectionType: 'service-bus', category: 'messaging' };
        }
        if (configType.startsWith('vm:')) {
            return { connectionType: 'storage-queue', category: 'messaging' };
        }
        if (configType.startsWith('ftp:')) {
            return { connectionType: 'ftp', category: 'file' };
        }
        if (configType.startsWith('sftp:')) {
            return { connectionType: 'ftp', category: 'file' };
        }
        if (configType.startsWith('file:')) {
            return { connectionType: 'file-system', category: 'file' };
        }
        if (configType.startsWith('email:')) {
            return { connectionType: 'smtp', category: 'email' };
        }
        if (configType.startsWith('wsc:')) {
            return { connectionType: 'http', category: 'api' };
        }
        if (configType.startsWith('sap:')) {
            return { connectionType: 'sap', category: 'erp' };
        }
        if (configType.startsWith('salesforce:')) {
            return { connectionType: 'http', category: 'api' };
        }

        return { connectionType: null, category: 'unknown' };
    }

    /**
     * Extract authentication configuration from a global config.
     */
    private extractAuthConfig(config: MuleGlobalConfig): Record<string, unknown> | undefined {
        const connChildren = config.connection?.children || [];

        for (const child of connChildren) {
            if (
                child.tagName.includes('authentication') ||
                child.tagName.includes('oauth') ||
                child.tagName.includes('tls')
            ) {
                return {
                    type: child.tagName,
                    ...child.attributes,
                };
            }
        }

        // Check for basic auth attributes on connection
        const connAttrs = config.connection?.attributes || {};
        if (connAttrs['user'] || connAttrs['username']) {
            return {
                type: 'basic',
                username: connAttrs['user'] || connAttrs['username'],
            };
        }

        return undefined;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert parsed Mule application info to IR document.
     */
    private convertToIR(
        appInfo: MuleApplicationInfo,
        connections: IRConnection[],
        filePath: string,
        errors: ParseErrorAccumulator
    ): IRDocument {
        const name = appInfo.name;
        const ir = createEmptyIRDocument(`mulesoft-${name}`, name, 'mulesoft');

        // Build triggers, actions, variables, gaps for all flows
        const allTriggers: IRTrigger[] = [];
        const allActions: IRAction[] = [];
        const allVariables: IRVariable[] = [];
        const allGaps: IRGap[] = [];

        // Process each flow
        for (const flow of appInfo.flows) {
            // Convert source to trigger
            if (flow.source) {
                const trigger = this.convertSourceToTrigger(flow.source, flow.name);
                if (trigger) {
                    allTriggers.push(trigger);
                }
            }

            // Convert processors to actions
            const { actions, variables, gaps } = this.convertProcessorsToActions(
                flow.processors,
                flow.name,
                flow.source ? `trigger-${this.sanitizeId(flow.name)}` : undefined,
                errors
            );
            allActions.push(...actions);
            allVariables.push(...variables);
            allGaps.push(...gaps);

            // Convert error handler
            if (flow.errorHandler) {
                const errorGaps = this.convertErrorHandler(flow.errorHandler, flow.name);
                allGaps.push(...errorGaps);
            }
        }

        // Process sub-flows (add as actions that can be called)
        for (const subFlow of appInfo.subFlows) {
            const { actions, variables, gaps } = this.convertProcessorsToActions(
                subFlow.processors,
                subFlow.name,
                undefined,
                errors
            );
            allActions.push(...actions);
            allVariables.push(...variables);
            allGaps.push(...gaps);
        }

        // Add DataWeave gap if any transform actions exist
        const hasDataWeave = allActions.some(
            (a) =>
                a.sourceMapping?.mulesoft &&
                (a.sourceMapping.mulesoft as Record<string, unknown>)['processor'] ===
                    'ee:transform'
        );
        if (hasDataWeave) {
            allGaps.push({
                id: 'gap-dataweave-conversion',
                category: 'complex-logic' as GapCategory,
                severity: 'medium' as GapSeverity,
                title: 'DataWeave Transformation Conversion',
                description:
                    'DataWeave scripts need conversion to Liquid templates or Azure Function code for Logic Apps.',
                sourceFeature: {
                    platform: 'mulesoft',
                    name: 'DataWeave',
                },
                status: 'open',
                resolution: {
                    strategy: 'alternative',
                    description: 'Convert DataWeave expressions to Liquid templates',
                },
            } as unknown as IRGap);
        }

        // Build error handling config
        const errorHandling = this.buildErrorHandlingConfig(appInfo);

        // Build extensions
        const extensions = {
            mulesoft: {
                projectType: 'mule-application',
                flows: appInfo.flows.map((f) => f.name),
                subFlows: appInfo.subFlows.map((sf) => sf.name),
                globalConfigs: appInfo.globalConfigs.map((gc) => gc.name),
                namespaces: appInfo.namespaces,
            },
        };

        // Assemble the IR document
        const result: IRDocument = {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platform: 'mulesoft',
                    application: name,
                    artifact: {
                        name,
                        type: 'flow',
                        filePath,
                        fileType: 'xml',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    complexity: this.estimateComplexity(appInfo),
                    complexityScore: this.calculateComplexityScore(appInfo),
                    notes: [
                        `Parsed from Mule 4 XML: ${path.basename(filePath)}`,
                        `Flows: ${appInfo.flows.length}`,
                        `Sub-flows: ${appInfo.subFlows.length}`,
                        `Global configs: ${appInfo.globalConfigs.length}`,
                    ],
                },
            },
            triggers: allTriggers,
            actions: allActions,
            connections,
            variables: allVariables.length > 0 ? allVariables : undefined,
            gaps: allGaps,
            errorHandling: errorHandling || undefined,
            extensions,
        } as unknown as IRDocument;

        return result;
    }

    // =========================================================================
    // Trigger Conversion
    // =========================================================================

    /**
     * Convert a Mule source to an IR trigger.
     */
    private convertSourceToTrigger(source: MuleSource, flowName: string): IRTrigger | null {
        const mapping = MULE_SOURCE_TO_TRIGGER_MAP[source.type];
        const triggerType = (mapping?.triggerType || 'custom') as TriggerType;
        const category = mapping?.category || 'custom';

        const triggerId = `trigger-${this.sanitizeId(flowName)}`;

        const trigger: Record<string, unknown> = {
            id: triggerId,
            name: source.attributes['doc:name'] || `${source.type}_trigger`,
            type: triggerType,
            category,
            config: this.buildTriggerConfig(source),
            sourceMapping: {
                mulesoft: {
                    processor: source.type,
                    configRef: source.configRef,
                    ...source.attributes,
                },
            },
            targetMapping: {
                logicAppsAction: MULE_TO_LA_ACTION_MAP[source.type]?.action || 'custom',
                gap: !mapping,
            },
        };

        // Add outputs for HTTP triggers
        if (source.type === 'http:listener') {
            trigger['outputs'] = {
                body: { type: 'json' },
            };
        }

        return trigger as unknown as IRTrigger;
    }

    /**
     * Build trigger-specific configuration from source attributes.
     */
    private buildTriggerConfig(source: MuleSource): Record<string, unknown> {
        const config: Record<string, unknown> = {};

        switch (source.type) {
            case 'http:listener': {
                config['method'] = source.attributes['allowedMethods'] || 'POST';
                config['relativePath'] = source.attributes['path'] || '/';
                break;
            }
            case 'scheduler': {
                // Parse scheduling expression from child elements
                const schedulingEl = source.children.find(
                    (c) =>
                        c.tagName === 'scheduling-strategy' ||
                        c.tagName === 'fixed-frequency' ||
                        c.tagName === 'cron'
                );
                if (schedulingEl) {
                    if (schedulingEl.tagName === 'scheduling-strategy') {
                        const inner = schedulingEl.children[0];
                        if (inner?.tagName === 'fixed-frequency') {
                            config['frequency'] = inner.attributes['frequency'] || '1000';
                            config['timeUnit'] = inner.attributes['timeUnit'] || 'MILLISECONDS';
                        } else if (inner?.tagName === 'cron') {
                            config['cronExpression'] = inner.attributes['expression'];
                            config['timeZone'] = inner.attributes['timeZone'];
                        }
                    }
                }
                break;
            }
            case 'jms:listener':
            case 'vm:listener': {
                config['destination'] =
                    source.attributes['destination'] || source.attributes['queueName'];
                break;
            }
            case 'file:listener': {
                config['directory'] = source.attributes['directory'];
                config['matcher'] = source.attributes['matcher'];
                break;
            }
            case 'ftp:listener':
            case 'sftp:listener': {
                config['directory'] = source.attributes['directory'];
                break;
            }
            default:
                break;
        }

        return config;
    }

    // =========================================================================
    // Action Conversion
    // =========================================================================

    /**
     * Convert an array of Mule processors to IR actions.
     */
    private convertProcessorsToActions(
        processors: readonly MuleProcessor[],
        flowName: string,
        previousActionId: string | undefined,
        errors: ParseErrorAccumulator
    ): { actions: IRAction[]; variables: IRVariable[]; gaps: IRGap[] } {
        const actions: IRAction[] = [];
        const variables: IRVariable[] = [];
        const gaps: IRGap[] = [];
        let prevId = previousActionId;

        for (const processor of processors) {
            const result = this.convertProcessor(processor, flowName, prevId, errors);
            if (result) {
                actions.push(result.action);
                if (result.variables) {
                    variables.push(...result.variables);
                }
                if (result.gap) {
                    gaps.push(result.gap);
                }
                prevId = result.action.id;

                // If the processor has nested actions, add them too
                if (result.nestedActions) {
                    actions.push(...result.nestedActions);
                }
            }
        }

        return { actions, variables, gaps };
    }

    /**
     * Convert a single Mule processor to an IR action.
     */
    private convertProcessor(
        processor: MuleProcessor,
        flowName: string,
        previousActionId: string | undefined,
        errors: ParseErrorAccumulator
    ): {
        action: IRAction;
        variables?: IRVariable[];
        gap?: IRGap;
        nestedActions?: IRAction[];
    } | null {
        this.actionCounter++;
        const _actionId = `action-${this.sanitizeId(flowName)}-${this.actionCounter}`;
        const displayName = processor.docName || this.generateActionName(processor);

        const laMapping = MULE_TO_LA_ACTION_MAP[processor.qualifiedName];

        const runAfter: RunAfterConfig | undefined = previousActionId
            ? { [previousActionId]: ['Succeeded'] }
            : undefined;

        const { actionType, actionCategory } = this.mapProcessorToActionType(processor);

        const baseAction: Record<string, unknown> = {
            id: _actionId,
            name: displayName,
            type: actionType,
            category: actionCategory,
            runAfter,
            sourceMapping: {
                mulesoft: {
                    processor: processor.qualifiedName,
                    configRef: processor.configRef,
                    docName: processor.docName,
                    ...(processor.collection ? { collection: processor.collection } : {}),
                    ...(processor.dataweaveContent?.setPayload
                        ? { dataweaveScript: processor.dataweaveContent.setPayload }
                        : {}),
                },
            },
            targetMapping: {
                logicAppsAction: laMapping?.action || 'custom',
                gap: laMapping?.gap ?? true,
                ...(laMapping?.notes ? { gapReason: laMapping.notes } : {}),
            },
        };

        // Build type-specific config
        const { config, nestedActions, variables, gap } = this.buildActionConfig(
            processor,
            _actionId,
            flowName,
            errors
        );
        if (config) {
            baseAction['config'] = config;
        }

        // Special handling for set-variable (also creates an IRVariable)
        if (processor.type === 'set-variable') {
            const varName = processor.attributes['variableName'] || 'unknown';
            const varValue = processor.attributes['value'] || '';
            const variable: IRVariable = {
                id: `var-${this.sanitizeId(varName)}`,
                name: varName,
                type: 'string',
                defaultValue: varValue,
                sourceMapping: {
                    mulesoft: {
                        type: 'variable',
                        name: varName,
                        expression: varValue,
                    },
                },
            } as unknown as IRVariable;

            return {
                action: baseAction as unknown as IRAction,
                variables: [variable, ...(variables || [])],
                gap,
                nestedActions,
            };
        }

        return {
            action: baseAction as unknown as IRAction,
            variables,
            gap,
            nestedActions,
        };
    }

    /**
     * Build type-specific action configuration.
     */
    private buildActionConfig(
        processor: MuleProcessor,
        _actionId: string,
        _flowName: string,
        errors: ParseErrorAccumulator
    ): {
        config?: Record<string, unknown>;
        nestedActions?: IRAction[];
        variables?: IRVariable[];
        gap?: IRGap;
    } {
        switch (processor.type) {
            case 'ee:transform':
                return {
                    config: {
                        transformType: 'dataweave',
                        dataweaveScript: processor.dataweaveContent?.setPayload,
                        variables: processor.dataweaveContent?.setVariables,
                    },
                };

            case 'http:request':
                return {
                    config: {
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                        method: processor.attributes['method'] || 'GET',
                        path: processor.attributes['path'] || '/',
                    },
                };

            case 'choice': {
                const cases: Record<string, { actions: string[] }> = {};
                const nestedActions: IRAction[] = [];
                const allVars: IRVariable[] = [];

                if (processor.branches) {
                    for (let i = 0; i < processor.branches.length; i++) {
                        const branchItem: MuleBranch | undefined = processor.branches[i];
                        if (!branchItem) {
                            continue;
                        }
                        const branchResult = this.convertProcessorsToActions(
                            branchItem.processors,
                            `${_flowName}-branch-${i}`,
                            undefined,
                            errors
                        );
                        nestedActions.push(...branchResult.actions);
                        allVars.push(...branchResult.variables);

                        const branchActionIds = branchResult.actions.map((a) => a.id);

                        if (branchItem.isDefault) {
                            // default branch tracked via cases with special key
                            cases['__default__'] = { actions: branchActionIds };
                        } else {
                            const label = branchItem.expression || `when-${i}`;
                            cases[label] = { actions: branchActionIds };
                        }
                    }
                }

                return {
                    config: { expression: '@body()' },
                    nestedActions,
                    variables: allVars.length ? allVars : undefined,
                };
            }

            case 'scatter-gather': {
                const sgBranches: Record<string, { actions: string[] }> = {};
                const sgNestedActions: IRAction[] = [];

                if (processor.branches) {
                    for (let i = 0; i < processor.branches.length; i++) {
                        const sgBranch: MuleBranch | undefined = processor.branches[i];
                        if (!sgBranch) {
                            continue;
                        }
                        const branchResult = this.convertProcessorsToActions(
                            sgBranch.processors,
                            `${_flowName}-parallel-${i}`,
                            undefined,
                            errors
                        );
                        sgNestedActions.push(...branchResult.actions);

                        const label = sgBranch.label || `route-${i}`;
                        sgBranches[label] = {
                            actions: branchResult.actions.map((a) => a.id),
                        };
                    }
                }

                return { config: { branches: sgBranches }, nestedActions: sgNestedActions };
            }

            case 'foreach': {
                const feNestedActions: IRAction[] = [];
                const feVars: IRVariable[] = [];

                if (processor.nestedProcessors) {
                    const result = this.convertProcessorsToActions(
                        processor.nestedProcessors,
                        `${_flowName}-foreach`,
                        undefined,
                        errors
                    );
                    feNestedActions.push(...result.actions);
                    feVars.push(...result.variables);
                }

                return {
                    config: {
                        items: processor.collection || '#[payload]',
                        concurrency: processor.attributes['batchSize']
                            ? { degree: parseInt(processor.attributes['batchSize'], 10) }
                            : undefined,
                    },
                    nestedActions: feNestedActions,
                    variables: feVars.length ? feVars : undefined,
                };
            }

            case 'until-successful': {
                const usNestedActions: IRAction[] = [];

                if (processor.nestedProcessors) {
                    const result = this.convertProcessorsToActions(
                        processor.nestedProcessors,
                        `${_flowName}-until`,
                        undefined,
                        errors
                    );
                    usNestedActions.push(...result.actions);
                }

                return {
                    config: {
                        maxRetries: processor.attributes['maxRetries'] || '5',
                        millisBetweenRetries:
                            processor.attributes['millisBetweenRetries'] || '60000',
                    },
                    nestedActions: usNestedActions,
                };
            }

            case 'try': {
                const tryNestedActions: IRAction[] = [];

                if (processor.nestedProcessors) {
                    const result = this.convertProcessorsToActions(
                        processor.nestedProcessors,
                        `${_flowName}-try`,
                        undefined,
                        errors
                    );
                    tryNestedActions.push(...result.actions);
                }

                return {
                    config: { transactionalAction: processor.attributes['transactionalAction'] },
                    nestedActions: tryNestedActions,
                };
            }

            case 'flow-ref':
                return {
                    config: {
                        workflowName: processor.attributes['name'],
                    },
                };

            case 'db:select':
            case 'db:insert':
            case 'db:update':
            case 'db:delete':
            case 'db:stored-procedure': {
                const sqlEl = processor.children.find(
                    (c) => c.tagName.includes('sql') || c.tagName.includes('stored-procedure-name')
                );
                const inputParamsEl = processor.children.find((c) =>
                    c.tagName.includes('input-parameters')
                );

                return {
                    config: {
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                        operation: processor.localName,
                        sql: sqlEl?.textContent?.trim(),
                        inputParameters: inputParamsEl?.textContent?.trim(),
                    },
                };
            }

            case 'set-variable':
                return {
                    config: {
                        variableName: processor.attributes['variableName'],
                        value: processor.attributes['value'],
                    },
                };

            case 'set-payload':
                return {
                    config: {
                        value: processor.attributes['value'],
                        mimeType: processor.attributes['mimeType'],
                    },
                };

            case 'logger':
                return {
                    config: {
                        level: processor.attributes['level'] || 'INFO',
                        message: processor.attributes['message'],
                    },
                };

            case 'raise-error':
                return {
                    config: {
                        type: processor.attributes['type'],
                        description: processor.attributes['description'],
                    },
                };

            case 'validation:is-true':
            case 'validation:is-false':
            case 'validation:is-not-null':
            case 'validation:is-null':
                return {
                    config: {
                        expression:
                            processor.attributes['expression'] || processor.attributes['value'],
                        message: processor.attributes['message'],
                    },
                };

            case 'file:read':
            case 'file:write':
            case 'ftp:read':
            case 'ftp:write':
            case 'sftp:read':
            case 'sftp:write':
                return {
                    config: {
                        path: processor.attributes['path'],
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                    },
                };

            case 'wsc:consume':
                return {
                    config: {
                        operation: processor.attributes['operation'],
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                    },
                };

            case 'jms:publish':
            case 'vm:publish':
                return {
                    config: {
                        destination: processor.attributes['destination'],
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                    },
                };

            case 'email:send':
                return {
                    config: {
                        toAddresses: processor.attributes['toAddresses'],
                        subject: processor.attributes['subject'],
                        connectionRef: processor.configRef
                            ? `#/connections/conn-${processor.configRef}`
                            : undefined,
                    },
                };

            default:
                return {};
        }
    }

    /**
     * Map Mule processor type to IR action type and category.
     */
    private mapProcessorToActionType(processor: MuleProcessor): {
        actionType: ActionType;
        actionCategory: string;
    } {
        const typeMap: Record<string, { actionType: ActionType; actionCategory: string }> = {
            'ee:transform': { actionType: 'transform', actionCategory: 'data' },
            'set-payload': { actionType: 'compose', actionCategory: 'data' },
            'set-variable': { actionType: 'set-variable', actionCategory: 'utility' },
            'remove-variable': { actionType: 'set-variable', actionCategory: 'utility' },
            logger: { actionType: 'compose', actionCategory: 'utility' },
            'http:request': { actionType: 'http-call', actionCategory: 'integration' },
            choice: { actionType: 'switch', actionCategory: 'control-flow' },
            'scatter-gather': { actionType: 'parallel', actionCategory: 'control-flow' },
            foreach: { actionType: 'foreach', actionCategory: 'control-flow' },
            'until-successful': { actionType: 'until', actionCategory: 'control-flow' },
            try: { actionType: 'scope', actionCategory: 'control-flow' },
            'flow-ref': { actionType: 'call-workflow', actionCategory: 'workflow' },
            'raise-error': { actionType: 'terminate', actionCategory: 'utility' },
            'parse-template': { actionType: 'compose', actionCategory: 'data' },
            'db:select': { actionType: 'database-query', actionCategory: 'integration' },
            'db:insert': { actionType: 'database-execute', actionCategory: 'integration' },
            'db:update': { actionType: 'database-execute', actionCategory: 'integration' },
            'db:delete': { actionType: 'database-execute', actionCategory: 'integration' },
            'db:stored-procedure': {
                actionType: 'database-execute',
                actionCategory: 'integration',
            },
            'db:bulk-insert': { actionType: 'database-execute', actionCategory: 'integration' },
            'db:bulk-update': { actionType: 'database-execute', actionCategory: 'integration' },
            'db:bulk-delete': { actionType: 'database-execute', actionCategory: 'integration' },
            'file:read': { actionType: 'file-read', actionCategory: 'integration' },
            'file:write': { actionType: 'file-write', actionCategory: 'integration' },
            'ftp:read': { actionType: 'ftp-operation', actionCategory: 'integration' },
            'ftp:write': { actionType: 'ftp-operation', actionCategory: 'integration' },
            'sftp:read': { actionType: 'sftp-operation', actionCategory: 'integration' },
            'sftp:write': { actionType: 'sftp-operation', actionCategory: 'integration' },
            'jms:publish': { actionType: 'queue-send', actionCategory: 'integration' },
            'jms:consume': { actionType: 'queue-receive', actionCategory: 'integration' },
            'vm:publish': { actionType: 'queue-send', actionCategory: 'integration' },
            'vm:consume': { actionType: 'queue-receive', actionCategory: 'integration' },
            'wsc:consume': { actionType: 'http-call', actionCategory: 'integration' },
            'email:send': { actionType: 'email-send', actionCategory: 'integration' },
            'os:store': { actionType: 'custom', actionCategory: 'integration' },
            'os:retrieve': { actionType: 'custom', actionCategory: 'integration' },
            'validation:is-true': { actionType: 'validate', actionCategory: 'data' },
            'validation:is-false': { actionType: 'validate', actionCategory: 'data' },
            'validation:is-not-null': { actionType: 'validate', actionCategory: 'data' },
            'validation:is-null': { actionType: 'validate', actionCategory: 'data' },
            'sap:sync-rfc': { actionType: 'sap-call', actionCategory: 'integration' },
            'sap:async-rfc': { actionType: 'sap-call', actionCategory: 'integration' },
            'sap:send-idoc': { actionType: 'sap-call', actionCategory: 'integration' },
            'salesforce:query': {
                actionType: 'salesforce-operation',
                actionCategory: 'integration',
            },
            'salesforce:create': {
                actionType: 'salesforce-operation',
                actionCategory: 'integration',
            },
            'salesforce:update': {
                actionType: 'salesforce-operation',
                actionCategory: 'integration',
            },
            'salesforce:delete': {
                actionType: 'salesforce-operation',
                actionCategory: 'integration',
            },
            'salesforce:upsert': {
                actionType: 'salesforce-operation',
                actionCategory: 'integration',
            },
        };

        const mapped = typeMap[processor.type];
        if (mapped) {
            return mapped;
        }

        return { actionType: 'custom', actionCategory: 'integration' };
    }

    /**
     * Generate a display name for a processor that doesn't have doc:name.
     */
    private generateActionName(processor: MuleProcessor): string {
        const nameParts = processor.qualifiedName.replace(':', '_').split('_');
        return nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('_');
    }

    // =========================================================================
    // Error Handler Conversion
    // =========================================================================

    /**
     * Convert error handler to IR gaps (error handling patterns differ between platforms).
     */
    private convertErrorHandler(errorHandler: MuleErrorHandler, flowName: string): IRGap[] {
        const gaps: IRGap[] = [];

        for (const strategy of errorHandler.strategies) {
            if (strategy.type === 'on-error-continue') {
                // on-error-continue maps well to Scope + Run After (Failed)
                // No gap needed
            } else if (strategy.type === 'on-error-propagate') {
                // on-error-propagate may need special handling
                if (strategy.errorType && strategy.errorType !== 'ANY') {
                    gaps.push({
                        id: `gap-error-${this.sanitizeId(flowName)}-${strategy.errorType}`,
                        category: 'unsupported-feature' as GapCategory,
                        severity: 'low' as GapSeverity,
                        title: `Error type mapping: ${strategy.errorType}`,
                        description: `MuleSoft error type '${strategy.errorType}' needs mapping to Logic Apps error handling pattern.`,
                        sourceFeature: {
                            platform: 'mulesoft',
                            name: `on-error-propagate (${strategy.errorType})`,
                        },
                        status: 'open',
                    } as unknown as IRGap);
                }
            }
        }

        return gaps;
    }

    /**
     * Build IR error handling config from Mule error handlers.
     */
    private buildErrorHandlingConfig(appInfo: MuleApplicationInfo): IRErrorHandlingConfig | null {
        const handlers: Record<string, unknown>[] = [];

        // Collect error handlers from all flows
        for (const flow of appInfo.flows) {
            if (flow.errorHandler) {
                for (const strategy of flow.errorHandler.strategies) {
                    handlers.push({
                        id: `handler-${this.sanitizeId(flow.name)}-${strategy.type}`,
                        name: `${flow.name}_${strategy.type}`,
                        type: strategy.type === 'on-error-continue' ? 'catch' : 'catch',
                        trigger: {
                            exceptionTypes: strategy.errorType ? [strategy.errorType] : ['ANY'],
                        },
                        sourceMapping: {
                            mulesoft: {
                                handler: strategy.type,
                                type: strategy.errorType || 'ANY',
                                logException: strategy.logException,
                                enableNotifications: strategy.enableNotifications,
                                when: strategy.when,
                            },
                        },
                    });
                }
            }
        }

        // Add global error handler
        if (appInfo.globalErrorHandler) {
            for (const strategy of appInfo.globalErrorHandler.strategies) {
                handlers.push({
                    id: `handler-global-${strategy.type}`,
                    name: `Global_${strategy.type}`,
                    type: 'catch',
                    trigger: {
                        exceptionTypes: strategy.errorType ? [strategy.errorType] : ['ANY'],
                    },
                    sourceMapping: {
                        mulesoft: {
                            handler: strategy.type,
                            type: strategy.errorType || 'ANY',
                            logException: strategy.logException,
                        },
                    },
                });
            }
        }

        if (handlers.length === 0) {
            return null;
        }

        return { handlers } as unknown as IRErrorHandlingConfig;
    }

    // =========================================================================
    // Complexity Estimation
    // =========================================================================

    /**
     * Estimate complexity level.
     */
    private estimateComplexity(
        appInfo: MuleApplicationInfo
    ): 'low' | 'medium' | 'high' | 'very-high' {
        const score = this.calculateComplexityScore(appInfo);

        if (score <= 25) {
            return 'low';
        }
        if (score <= 50) {
            return 'medium';
        }
        if (score <= 75) {
            return 'high';
        }
        return 'very-high';
    }

    /**
     * Calculate a complexity score (0-100).
     */
    private calculateComplexityScore(appInfo: MuleApplicationInfo): number {
        let score = 0;

        // Base: number of flows
        score += appInfo.flows.length * 5;
        score += appInfo.subFlows.length * 3;

        // Processors
        const totalProcessors =
            appInfo.flows.reduce((sum, f) => sum + f.processors.length, 0) +
            appInfo.subFlows.reduce((sum, sf) => sum + sf.processors.length, 0);
        score += Math.min(totalProcessors * 2, 30);

        // Connector diversity
        const connectorTypes = new Set(appInfo.globalConfigs.map((gc) => gc.namespace));
        score += connectorTypes.size * 3;

        // DataWeave transforms add complexity
        const hasTransforms = appInfo.flows.some((f) =>
            f.processors.some((p) => p.type === 'ee:transform')
        );
        if (hasTransforms) {
            score += 10;
        }

        // Error handlers add complexity
        const hasErrorHandlers = appInfo.flows.some((f) => f.errorHandler);
        if (hasErrorHandlers) {
            score += 5;
        }

        // Global error handler
        if (appInfo.globalErrorHandler) {
            score += 3;
        }

        return Math.min(score, 100);
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    /**
     * Split a qualified XML name into namespace prefix and local name.
     */
    private splitQualifiedName(qualifiedName: string): [string, string] {
        const colonIndex = qualifiedName.indexOf(':');
        if (colonIndex >= 0) {
            return [
                qualifiedName.substring(0, colonIndex),
                qualifiedName.substring(colonIndex + 1),
            ];
        }
        return ['', qualifiedName];
    }

    /**
     * Get all attributes of an element as a record.
     */
    private getElementAttributes(element: Element): Record<string, string> {
        const attrs: Record<string, string> = {};

        if (element.attributes) {
            for (const attr of Array.from(element.attributes)) {
                if (attr) {
                    attrs[attr.name] = attr.value;
                }
            }
        }

        return attrs;
    }

    /**
     * Parse child elements into MuleElement array.
     */
    private parseChildElements(element: Element): MuleElement[] {
        const elements: MuleElement[] = [];
        const children = getAllChildElements(element);

        for (const child of children) {
            elements.push({
                tagName: child.tagName,
                attributes: this.getElementAttributes(child),
                textContent: child.textContent?.trim() || undefined,
                children: this.parseChildElements(child),
            });
        }

        return elements;
    }

    /**
     * Sanitize a string for use as an ID.
     */
    private sanitizeId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
