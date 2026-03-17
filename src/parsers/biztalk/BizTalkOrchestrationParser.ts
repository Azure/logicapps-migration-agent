/**
 * BizTalk Orchestration Parser
 *
 * Parses BizTalk .odx orchestration files into IR format.
 *
 * @module parsers/biztalk/BizTalkOrchestrationParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import {
    BizTalkOrchestrationInfo,
    BizTalkShape,
    BizTalkReceiveShape,
    BizTalkSendShape,
    BizTalkTransformShape,
    BizTalkConstructMessageShape,
    BizTalkMessageAssignmentShape,
    BizTalkExpressionShape,
    BizTalkDecideShape,
    BizTalkLoopShape,
    BizTalkListenShape,
    BizTalkParallelShape,
    BizTalkScopeShape,
    BizTalkDelayShape,
    BizTalkCallOrchestrationShape,
    BizTalkStartOrchestrationShape,
    BizTalkCallRulesShape,
    BizTalkPort,
    BizTalkPortOperation,
    BizTalkMessageVariable,
    BizTalkVariable,
    BizTalkCorrelationType,
    BizTalkCorrelationSet,
    BizTalkDecideBranch,
    BizTalkParallelBranch,
    BizTalkExceptionHandler,
} from './types';
import { parseXml, getAttr, getAllElements } from '../utils/xml';
import {
    IRDocument,
    createEmptyIRDocument,
    IRTrigger,
    IRAction,
    ActionType,
    TriggerType,
    RunAfterConfig,
} from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// BizTalk Orchestration Parser
// =============================================================================

/**
 * Parser for BizTalk orchestration (.odx) files.
 */
export class BizTalkOrchestrationParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.odx'],
        fileTypes: ['orchestration'],
        supportsFolder: false,
        description: 'Parses BizTalk orchestrations (.odx) into IR actions and triggers',
    };

    // Shape position counter
    private shapePosition = 0;

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
        this.shapePosition = 0;

        this.reportProgress(
            options.onProgress,
            1,
            4,
            `Reading orchestration: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Orchestration file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 4, 'Parsing orchestration structure');

        // Parse orchestration info
        const orchInfo = this.parseOrchestrationXml(doc, inputPath, errors);
        if (!orchInfo) {
            return null;
        }

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 4, 'Converting to IR');

        // Convert to IR
        const ir = this.convertToIR(orchInfo, errors);

        this.reportProgress(options.onProgress, 4, 4, 'Orchestration parsing complete');

        return ir;
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.odx'),
                type: 'orchestration',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.odx'),
                type: 'orchestration',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const orchInfo = this.parseOrchestrationXml(doc, filePath, errors);

        if (!orchInfo) {
            return {
                name: path.basename(filePath, '.odx'),
                type: 'orchestration',
            };
        }

        return {
            name: orchInfo.name,
            type: 'orchestration',
            elementCount: orchInfo.shapes.length,
            references: [
                ...orchInfo.ports.map((p) => p.portTypeName),
                ...orchInfo.messages.map((m) => m.messageTypeName),
            ],
            description:
                orchInfo.description || `Orchestration with ${orchInfo.shapes.length} shapes`,
        };
    }

    // =========================================================================
    // Orchestration XML Parsing
    // =========================================================================

    /**
     * Parse orchestration XML document.
     */
    private parseOrchestrationXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): BizTalkOrchestrationInfo | null {
        const rootElement = doc.documentElement;

        // Find the Module element
        const moduleElements = getAllElements(rootElement, 'om:Element');
        const moduleElement = moduleElements.find((el) => getAttr(el, 'Type') === 'Module');

        if (!moduleElement) {
            errors.addError(
                ParseErrorCodes.INVALID_ORCHESTRATION,
                'Could not find Module element in orchestration',
                { filePath }
            );
            return null;
        }

        // Get module/namespace name
        const namespace = this.getElementName(moduleElement, 'Unknown');

        // Find the ServiceDeclaration (orchestration)
        const serviceElement = this.findChildByType(moduleElement, 'ServiceDeclaration');
        if (!serviceElement) {
            errors.addError(
                ParseErrorCodes.INVALID_ORCHESTRATION,
                'Could not find ServiceDeclaration (orchestration) in module',
                { filePath }
            );
            return null;
        }

        const name = this.getElementName(serviceElement, path.basename(filePath, '.odx'));

        // Parse components
        const ports = this.parsePorts(serviceElement, errors);
        const messages = this.parseMessages(serviceElement, errors);
        const variables = this.parseVariables(serviceElement, errors);
        const correlationTypes = this.parseCorrelationTypes(moduleElement, errors);
        const correlationSets = this.parseCorrelationSets(serviceElement, errors);

        // Parse the body (shapes)
        const bodyElement = this.findChildByType(serviceElement, 'ServiceBody');
        const shapes: BizTalkShape[] = [];

        if (bodyElement) {
            this.parseShapeContainer(bodyElement, shapes, errors);
        }

        return {
            name,
            namespace,
            filePath,
            shapes,
            ports,
            messages,
            variables,
            correlationTypes,
            correlationSets,
            isServiceLink: false,
            description: this.getPropertyValue(serviceElement, 'Description'),
        };
    }

    /**
     * Find child element by Type attribute.
     */
    private findChildByType(parent: Element, type: string): Element | undefined {
        const children = getAllElements(parent, 'om:Element');
        return children.find((el) => getAttr(el, 'Type') === type);
    }

    /**
     * Find all children by Type attribute.
     */
    private findChildrenByType(parent: Element, type: string): Element[] {
        const children = getAllElements(parent, 'om:Element');
        return children.filter((el) => getAttr(el, 'Type') === type);
    }

    /**
     * Get property value from om:Property child.
     */
    private getPropertyValue(element: Element, propName: string): string | undefined {
        const properties = getAllElements(element, 'om:Property');
        const prop = properties.find((p) => getAttr(p, 'Name') === propName);
        return prop ? getAttr(prop, 'Value') : undefined;
    }

    /**
     * Get the Name of an om:Element.
     * In BizTalk ODX files, Name is stored as a child om:Property, not as an XML attribute.
     * This helper checks the om:Property first, then falls back to the XML attribute.
     */
    private getElementName(element: Element, fallback: string): string {
        return this.getPropertyValue(element, 'Name') || getAttr(element, 'Name') || fallback;
    }

    /**
     * Parse port definitions.
     */
    private parsePorts(serviceElement: Element, _errors: ParseErrorAccumulator): BizTalkPort[] {
        const ports: BizTalkPort[] = [];
        const portElements = this.findChildrenByType(serviceElement, 'PortDeclaration');

        for (const portEl of portElements) {
            const portName = this.getElementName(portEl, 'UnknownPort');
            const portDirection = this.getPropertyValue(portEl, 'Orientation') || 'implements';
            const portTypeName = this.getPropertyValue(portEl, 'PortType') || 'UnknownPortType';

            // Determine direction from orientation
            let direction: 'in' | 'out' | 'in-out' = 'in';
            if (portDirection.toLowerCase().includes('uses')) {
                direction = 'out';
            }

            // Parse operations (would need PortType definition)
            const operations: BizTalkPortOperation[] = [];

            ports.push({
                name: portName,
                portTypeName,
                direction,
                binding: 'later',
                operations,
            });
        }

        return ports;
    }

    /**
     * Parse message variables.
     */
    private parseMessages(
        serviceElement: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkMessageVariable[] {
        const messages: BizTalkMessageVariable[] = [];
        const msgElements = this.findChildrenByType(serviceElement, 'MessageDeclaration');

        for (const msgEl of msgElements) {
            const name = this.getElementName(msgEl, 'UnknownMessage');
            const type = this.getPropertyValue(msgEl, 'Type') || 'System.Xml.XmlDocument';

            messages.push({
                name,
                messageTypeName: type,
            });
        }

        return messages;
    }

    /**
     * Parse regular variables.
     */
    private parseVariables(
        serviceElement: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkVariable[] {
        const variables: BizTalkVariable[] = [];
        const varElements = this.findChildrenByType(serviceElement, 'VariableDeclaration');

        for (const varEl of varElements) {
            const name = this.getElementName(varEl, 'UnknownVar');
            const type = this.getPropertyValue(varEl, 'Type') || 'System.Object';
            const initialValue = this.getPropertyValue(varEl, 'InitialValue');

            variables.push({
                name,
                typeName: type,
                initialValue,
            });
        }

        return variables;
    }

    /**
     * Parse correlation types.
     */
    private parseCorrelationTypes(
        moduleElement: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkCorrelationType[] {
        const types: BizTalkCorrelationType[] = [];
        const typeElements = this.findChildrenByType(moduleElement, 'CorrelationType');

        for (const typeEl of typeElements) {
            const name = this.getElementName(typeEl, 'UnknownCorrelationType');
            const properties: string[] = [];

            // Parse correlation properties
            const propElements = this.findChildrenByType(typeEl, 'PropertyRef');
            for (const propEl of propElements) {
                const propName = getAttr(propEl, 'Name');
                if (propName) {
                    properties.push(propName);
                }
            }

            types.push({ name, properties });
        }

        return types;
    }

    /**
     * Parse correlation sets.
     */
    private parseCorrelationSets(
        serviceElement: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkCorrelationSet[] {
        const sets: BizTalkCorrelationSet[] = [];
        const setElements = this.findChildrenByType(serviceElement, 'CorrelationDeclaration');

        for (const setEl of setElements) {
            const name = this.getElementName(setEl, 'UnknownCorrelationSet');
            const typeName = this.getPropertyValue(setEl, 'Type') || 'UnknownType';

            sets.push({
                name,
                correlationTypeName: typeName,
            });
        }

        return sets;
    }

    /**
     * Parse shapes from a container element.
     */
    private parseShapeContainer(
        container: Element,
        shapes: BizTalkShape[],
        errors: ParseErrorAccumulator,
        parentName?: string
    ): void {
        const children = getAllElements(container, 'om:Element');

        for (const child of children) {
            // Only process direct children (check parent is the container)
            if (child.parentNode !== container) {
                continue;
            }

            const shape = this.parseShape(child, errors, parentName);
            if (shape) {
                shapes.push(shape);
            }
        }
    }

    /**
     * Parse a single shape element.
     */
    private parseShape(
        element: Element,
        errors: ParseErrorAccumulator,
        parentName?: string
    ): BizTalkShape | null {
        const type = getAttr(element, 'Type');
        const name = this.getElementName(element, `Shape_${this.shapePosition}`);

        if (!type) {
            return null;
        }

        const position = this.shapePosition++;
        const description = this.getPropertyValue(element, 'Description');

        switch (type) {
            case 'Receive':
                return this.parseReceiveShape(element, name, position, parentName, description);

            case 'Send':
                return this.parseSendShape(element, name, position, parentName, description);

            case 'Transform':
                return this.parseTransformShape(element, name, position, parentName, description);

            case 'Construct':
                return this.parseConstructMessageShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'MessageAssignment':
                return this.parseMessageAssignmentShape(
                    element,
                    name,
                    position,
                    parentName,
                    description
                );

            case 'VariableAssignment':
            case 'Expression':
                return this.parseExpressionShape(element, name, position, parentName, description);

            case 'Decide':
            case 'Decision':
                return this.parseDecideShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'While':
            case 'Loop':
                return this.parseLoopShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'Listen':
                return this.parseListenShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'ParallelAction':
            case 'Parallel':
                return this.parseParallelShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'Scope':
                return this.parseScopeShape(
                    element,
                    name,
                    position,
                    parentName,
                    description,
                    errors
                );

            case 'Delay':
                return this.parseDelayShape(element, name, position, parentName, description);

            case 'Call':
                return this.parseCallOrchestrationShape(
                    element,
                    name,
                    position,
                    parentName,
                    description
                );

            case 'Exec':
                return this.parseStartOrchestrationShape(
                    element,
                    name,
                    position,
                    parentName,
                    description
                );

            case 'CallRules':
                return this.parseCallRulesShape(element, name, position, parentName, description);

            case 'Suspend':
                return {
                    type: 'Unknown',
                    name,
                    position,
                    parent: parentName,
                    description,
                    originalType: 'Suspend',
                };

            case 'Task':
            case 'ServiceBody': {
                // Container for shapes, parse children
                const containerShapes: BizTalkShape[] = [];
                this.parseShapeContainer(element, containerShapes, errors, name);
                // Return first shape if single, or create group
                if (containerShapes.length === 1) {
                    return containerShapes[0];
                }
                // Skip empty containers
                return null;
            }

            default:
                // Unknown shape type - create placeholder
                return {
                    type: 'Unknown',
                    name,
                    position,
                    parent: parentName,
                    description,
                    originalType: type,
                };
        }
    }

    /**
     * Parse Receive shape.
     */
    private parseReceiveShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkReceiveShape {
        const portName = this.getPropertyValue(element, 'PortName') || '';
        const operationName = this.getPropertyValue(element, 'OperationName') || '';
        const messageName = this.getPropertyValue(element, 'MessageName') || '';
        const activates = this.getPropertyValue(element, 'Activate') === 'True';
        const filter = this.getPropertyValue(element, 'Filter');

        return {
            type: 'Receive',
            name,
            position,
            parent: parentName,
            description,
            portName,
            operationName,
            messageName,
            activates,
            filter,
        };
    }

    /**
     * Parse Send shape.
     */
    private parseSendShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkSendShape {
        const portName = this.getPropertyValue(element, 'PortName') || '';
        const operationName = this.getPropertyValue(element, 'OperationName') || '';
        const messageName = this.getPropertyValue(element, 'MessageName') || '';

        return {
            type: 'Send',
            name,
            position,
            parent: parentName,
            description,
            portName,
            operationName,
            messageName,
        };
    }

    /**
     * Parse Transform shape.
     */
    private parseTransformShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkTransformShape {
        const mapTypeName = this.getPropertyValue(element, 'ClassName') || '';
        const sourceMsg = this.getPropertyValue(element, 'SourceMessages') || '';
        const destMsg = this.getPropertyValue(element, 'DestinationMessages') || '';

        return {
            type: 'Transform',
            name,
            position,
            parent: parentName,
            description,
            mapTypeName,
            sourceMessages: sourceMsg ? sourceMsg.split(',').map((s) => s.trim()) : [],
            destinationMessages: destMsg ? destMsg.split(',').map((s) => s.trim()) : [],
        };
    }

    /**
     * Parse Construct Message shape.
     */
    private parseConstructMessageShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkConstructMessageShape {
        const constructedMsg = this.getPropertyValue(element, 'ConstructedMessages') || '';
        const children: BizTalkShape[] = [];

        this.parseShapeContainer(element, children, errors, name);

        return {
            type: 'ConstructMessage',
            name,
            position,
            parent: parentName,
            description,
            constructedMessages: constructedMsg
                ? constructedMsg.split(',').map((s) => s.trim())
                : [],
            children,
        };
    }

    /**
     * Parse Message Assignment shape.
     */
    private parseMessageAssignmentShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkMessageAssignmentShape {
        const expression = this.getPropertyValue(element, 'Expression') || '';

        return {
            type: 'MessageAssignment',
            name,
            position,
            parent: parentName,
            description,
            expression,
        };
    }

    /**
     * Parse Expression shape.
     */
    private parseExpressionShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkExpressionShape {
        const expression = this.getPropertyValue(element, 'Expression') || '';

        return {
            type: 'Expression',
            name,
            position,
            parent: parentName,
            description,
            expression,
        };
    }

    /**
     * Parse Decide shape.
     */
    private parseDecideShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkDecideShape {
        const branches: BizTalkDecideBranch[] = [];

        // Find branch elements
        const branchElements = this.findChildrenByType(element, 'DecideBranch');
        // Also check for 'DecisionBranch' (used in some ODX formats)
        const decisionBranchElements = this.findChildrenByType(element, 'DecisionBranch');
        const allBranches = [...branchElements, ...decisionBranchElements];

        for (const branchEl of allBranches) {
            const branchName = this.getElementName(branchEl, `Branch_${branches.length}`);
            const condition = this.getPropertyValue(branchEl, 'Expression');
            const isElse =
                this.getPropertyValue(branchEl, 'IsElse') === 'True' ||
                branchEl.getAttribute('Type')?.includes('Else');

            const children: BizTalkShape[] = [];
            this.parseShapeContainer(branchEl, children, errors, branchName);

            branches.push({
                name: branchName,
                condition: isElse ? null : condition || '',
                isElse: isElse ?? false,
                children,
            });
        }

        return {
            type: 'Decide',
            name,
            position,
            parent: parentName,
            description,
            branches,
        };
    }

    /**
     * Parse Loop shape.
     */
    private parseLoopShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkLoopShape {
        const condition = this.getPropertyValue(element, 'Expression') || 'true';
        const children: BizTalkShape[] = [];

        this.parseShapeContainer(element, children, errors, name);

        return {
            type: 'Loop',
            name,
            position,
            parent: parentName,
            description,
            condition,
            children,
        };
    }

    /**
     * Parse Listen shape.
     */
    private parseListenShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkListenShape {
        const branches: {
            name: string;
            branchType: 'receive' | 'delay';
            children: BizTalkShape[];
        }[] = [];

        const branchElements = this.findChildrenByType(element, 'ListenBranch');

        for (const branchEl of branchElements) {
            const branchName = this.getElementName(branchEl, `Branch_${branches.length}`);
            const children: BizTalkShape[] = [];
            this.parseShapeContainer(branchEl, children, errors, branchName);

            // Determine branch type from first child
            const branchType =
                children.length > 0 && children[0].type === 'Delay' ? 'delay' : 'receive';

            branches.push({
                name: branchName,
                branchType,
                children,
            });
        }

        return {
            type: 'Listen',
            name,
            position,
            parent: parentName,
            description,
            branches,
        };
    }

    /**
     * Parse Parallel shape.
     */
    private parseParallelShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkParallelShape {
        const branches: BizTalkParallelBranch[] = [];

        const branchElements = this.findChildrenByType(element, 'ParallelBranch');

        for (const branchEl of branchElements) {
            const branchName = this.getElementName(branchEl, `Branch_${branches.length}`);
            const children: BizTalkShape[] = [];
            this.parseShapeContainer(branchEl, children, errors, branchName);

            branches.push({
                name: branchName,
                children,
            });
        }

        return {
            type: 'Parallel',
            name,
            position,
            parent: parentName,
            description,
            branches,
        };
    }

    /**
     * Parse Scope shape.
     */
    private parseScopeShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined,
        errors: ParseErrorAccumulator
    ): BizTalkScopeShape {
        const transType = this.getPropertyValue(element, 'TransactionType') || 'None';
        let transactionType: 'none' | 'atomic' | 'long-running' = 'none';
        if (transType.toLowerCase().includes('atomic')) {
            transactionType = 'atomic';
        } else if (transType.toLowerCase().includes('long')) {
            transactionType = 'long-running';
        }

        const synchronized = this.getPropertyValue(element, 'Synchronized') === 'True';
        const timeout = this.getPropertyValue(element, 'Timeout');

        const children: BizTalkShape[] = [];
        const exceptionHandlers: BizTalkExceptionHandler[] = [];

        // Parse body shapes
        const bodyElement = this.findChildByType(element, 'ScopeBody');
        if (bodyElement) {
            this.parseShapeContainer(bodyElement, children, errors, name);
        } else {
            this.parseShapeContainer(element, children, errors, name);
        }

        // Parse exception handlers
        const catchElements = this.findChildrenByType(element, 'Catch');
        for (const catchEl of catchElements) {
            const handlerName = this.getElementName(catchEl, `Handler_${exceptionHandlers.length}`);
            const exceptionType =
                this.getPropertyValue(catchEl, 'ExceptionType') || 'System.Exception';
            const faultMessageName = this.getPropertyValue(catchEl, 'FaultMessageName');

            const handlerChildren: BizTalkShape[] = [];
            this.parseShapeContainer(catchEl, handlerChildren, errors, handlerName);

            exceptionHandlers.push({
                name: handlerName,
                exceptionType,
                faultMessageName,
                children: handlerChildren,
            });
        }

        return {
            type: 'Scope',
            name,
            position,
            parent: parentName,
            description,
            transactionType,
            synchronized,
            timeout,
            children,
            exceptionHandlers,
        };
    }

    /**
     * Parse Delay shape.
     */
    private parseDelayShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkDelayShape {
        const delayExpression =
            this.getPropertyValue(element, 'Expression') ||
            this.getPropertyValue(element, 'Timeout') ||
            '';
        const isDelayUntil = delayExpression.toLowerCase().includes('datetime');

        return {
            type: 'Delay',
            name,
            position,
            parent: parentName,
            description,
            delayExpression,
            isDelayUntil,
        };
    }

    /**
     * Parse Call Orchestration shape.
     */
    private parseCallOrchestrationShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkCallOrchestrationShape {
        const calledOrchestration =
            this.getPropertyValue(element, 'Invokee') ||
            this.getPropertyValue(element, 'TypeName') ||
            '';

        return {
            type: 'CallOrchestration',
            name,
            position,
            parent: parentName,
            description,
            calledOrchestration,
            parameters: [],
        };
    }

    /**
     * Parse Start Orchestration shape.
     */
    private parseStartOrchestrationShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkStartOrchestrationShape {
        const startedOrchestration =
            this.getPropertyValue(element, 'Invokee') ||
            this.getPropertyValue(element, 'TypeName') ||
            '';

        return {
            type: 'StartOrchestration',
            name,
            position,
            parent: parentName,
            description,
            startedOrchestration,
            parameters: [],
        };
    }

    /**
     * Parse a CallRules (Business Rules Policy) shape.
     */
    private parseCallRulesShape(
        element: Element,
        name: string,
        position: number,
        parentName: string | undefined,
        description: string | undefined
    ): BizTalkCallRulesShape {
        const policyName =
            this.getPropertyValue(element, 'PolicyName') ||
            this.getPropertyValue(element, 'RuleSetName') ||
            name;
        const policyVersion =
            this.getPropertyValue(element, 'PolicyVersion') ||
            this.getPropertyValue(element, 'RuleSetVersion');

        return {
            type: 'CallRules',
            name,
            position,
            parent: parentName,
            description,
            policyName,
            policyVersion: policyVersion || undefined,
            parameters: [],
        };
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert orchestration info to IR document.
     */
    private convertToIR(
        orchInfo: BizTalkOrchestrationInfo,
        errors: ParseErrorAccumulator
    ): IRDocument {
        const ir = createEmptyIRDocument(`orch-${orchInfo.name}`, orchInfo.name, 'biztalk');

        // Convert shapes to triggers and actions
        const triggers: IRTrigger[] = [];
        const actions: IRAction[] = [];
        let prevActionId: string | null = null;

        for (const shape of orchInfo.shapes) {
            const result = this.convertShapeToIR(shape, prevActionId, errors);

            if (result.trigger) {
                triggers.push(result.trigger);
            }

            for (const action of result.actions) {
                actions.push(action);
                prevActionId = action.id;
            }
        }

        // Update IR with converted data
        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: orchInfo.name,
                        type: 'orchestration',
                        filePath: orchInfo.filePath,
                        fileType: '.odx',
                    },
                },
            },
            triggers,
            actions,
            extensions: {
                biztalk: {
                    orchestrationName: orchInfo.name,
                    namespace: orchInfo.namespace,
                    ports: orchInfo.ports.map((p) => ({
                        name: p.name,
                        direction: p.direction,
                        portTypeName: p.portTypeName,
                    })),
                    correlationSets: orchInfo.correlationSets.map((c) => c.name),
                    messageVariables: orchInfo.messages.map((m) => m.name),
                    messageTypes: orchInfo.messages
                        .map((m) => m.messageTypeName)
                        .filter((t) => t && t !== 'System.Xml.XmlDocument'),
                },
            },
        };
    }

    /**
     * Convert a shape to IR trigger/actions.
     */
    private convertShapeToIR(
        shape: BizTalkShape,
        prevActionId: string | null,
        errors: ParseErrorAccumulator
    ): { trigger?: IRTrigger; actions: IRAction[] } {
        const runAfter: RunAfterConfig = prevActionId ? { [prevActionId]: ['Succeeded'] } : {};

        switch (shape.type) {
            case 'Receive':
                if ((shape as BizTalkReceiveShape).activates) {
                    // Activating receive becomes a trigger
                    return {
                        trigger: this.createHttpTrigger(shape as BizTalkReceiveShape),
                        actions: [],
                    };
                }
                // Non-activating receive becomes an action
                return {
                    actions: [this.createReceiveAction(shape as BizTalkReceiveShape, runAfter)],
                };

            case 'Send':
                return {
                    actions: [this.createSendAction(shape as BizTalkSendShape, runAfter)],
                };

            case 'Transform':
                return {
                    actions: [this.createTransformAction(shape as BizTalkTransformShape, runAfter)],
                };

            case 'ConstructMessage':
                return {
                    actions: this.createConstructActions(
                        shape as BizTalkConstructMessageShape,
                        runAfter
                    ),
                };

            case 'Expression':
            case 'MessageAssignment':
                return {
                    actions: [this.createExpressionAction(shape, runAfter)],
                };

            case 'Decide':
                return {
                    actions: [
                        this.createConditionAction(shape as BizTalkDecideShape, runAfter, errors),
                    ],
                };

            case 'Loop':
                return {
                    actions: [this.createUntilAction(shape as BizTalkLoopShape, runAfter, errors)],
                };

            case 'Parallel':
                return {
                    actions: [
                        this.createParallelAction(shape as BizTalkParallelShape, runAfter, errors),
                    ],
                };

            case 'Scope':
                return {
                    actions: [this.createScopeAction(shape as BizTalkScopeShape, runAfter, errors)],
                };

            case 'Delay':
                return {
                    actions: [this.createDelayAction(shape as BizTalkDelayShape, runAfter)],
                };

            case 'CallOrchestration': {
                const callShape = shape as BizTalkCallOrchestrationShape;
                return {
                    actions: [
                        {
                            id: `action-${shape.name}`,
                            name: shape.name,
                            type: 'call-workflow' as ActionType,
                            description:
                                shape.description ||
                                `Call orchestration ${callShape.calledOrchestration}`,
                            runAfter,
                            config: {
                                workflowName: callShape.calledOrchestration,
                                mode: 'sync',
                            },
                            sourceMapping: {
                                biztalk: {
                                    shapeType: 'CallOrchestration',
                                    shapeName: shape.name,
                                    calledOrchestration: callShape.calledOrchestration,
                                },
                            },
                            targetMapping: {
                                logicAppsAction: 'InvokeWorkflow',
                                confidence: 'high',
                            },
                        },
                    ] as unknown as IRAction[],
                };
            }

            case 'StartOrchestration': {
                const startShape = shape as BizTalkStartOrchestrationShape;
                return {
                    actions: [
                        {
                            id: `action-${shape.name}`,
                            name: shape.name,
                            type: 'call-workflow' as ActionType,
                            description:
                                shape.description ||
                                `Start orchestration ${startShape.startedOrchestration}`,
                            runAfter,
                            config: {
                                workflowName: startShape.startedOrchestration,
                                mode: 'async',
                            },
                            sourceMapping: {
                                biztalk: {
                                    shapeType: 'StartOrchestration',
                                    shapeName: shape.name,
                                    startedOrchestration: startShape.startedOrchestration,
                                },
                            },
                            targetMapping: {
                                logicAppsAction: 'InvokeWorkflow',
                                confidence: 'high',
                            },
                        },
                    ] as unknown as IRAction[],
                };
            }

            default:
                // Create generic custom action for unknown shapes
                return {
                    actions: [
                        {
                            id: `action-${shape.name}`,
                            name: shape.name,
                            type: 'custom' as ActionType,
                            description: shape.description || `Converted from ${shape.type} shape`,
                            runAfter,
                            config: {
                                originalShapeType: shape.type,
                            },
                            sourceMapping: {
                                biztalk: {
                                    shapeType: shape.type,
                                    shapeName: shape.name,
                                },
                            },
                        },
                    ] as unknown as IRAction[],
                };
        }
    }

    /**
     * Create HTTP trigger from activating receive.
     */
    private createHttpTrigger(shape: BizTalkReceiveShape): IRTrigger {
        return {
            id: `trigger-${shape.name}`,
            name: shape.name,
            type: 'http' as TriggerType,
            description: shape.description || `Receive from ${shape.portName}`,
            config: {
                method: 'POST',
                relativePath: `/${shape.operationName || shape.name}`,
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Receive',
                    portName: shape.portName,
                    operationName: shape.operationName,
                    messageName: shape.messageName,
                    activates: true,
                },
            },
            targetMapping: {
                logicAppsAction: 'When_a_HTTP_request_is_received',
                confidence: 'high',
            },
        } as unknown as IRTrigger;
    }

    /**
     * Create receive action (for non-activating receives).
     */
    private createReceiveAction(shape: BizTalkReceiveShape, runAfter: RunAfterConfig): IRAction {
        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'custom' as ActionType,
            description: shape.description || `Receive from ${shape.portName}`,
            runAfter,
            config: {
                originalType: 'Receive',
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Receive',
                    portName: shape.portName,
                    operationName: shape.operationName,
                    messageName: shape.messageName,
                },
            },
        } as unknown as IRAction;
    }

    /**
     * Create send action.
     */
    private createSendAction(shape: BizTalkSendShape, runAfter: RunAfterConfig): IRAction {
        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'http-call' as ActionType,
            description: shape.description || `Send to ${shape.portName}`,
            runAfter,
            config: {
                method: 'POST',
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Send',
                    portName: shape.portName,
                    operationName: shape.operationName,
                    messageName: shape.messageName,
                },
            },
            targetMapping: {
                logicAppsAction: 'HTTP',
                confidence: 'medium',
            },
        } as unknown as IRAction;
    }

    /**
     * Create transform action.
     */
    private createTransformAction(
        shape: BizTalkTransformShape,
        runAfter: RunAfterConfig
    ): IRAction {
        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'transform' as ActionType,
            description: shape.description || `Transform using ${shape.mapTypeName}`,
            runAfter,
            config: {
                transformType: 'xslt',
                mapReference: shape.mapTypeName,
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Transform',
                    mapTypeName: shape.mapTypeName,
                    sourceMessages: shape.sourceMessages,
                    destinationMessages: shape.destinationMessages,
                },
            },
            targetMapping: {
                logicAppsAction: 'Transform_XML',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }

    /**
     * Create construct message actions.
     * ConstructMessage is a wrapper shape that contains child shapes (Transform, MessageAssignment, etc.).
     * We create a scope-like action for the ConstructMessage itself and include children inside it.
     */
    private createConstructActions(
        shape: BizTalkConstructMessageShape,
        runAfter: RunAfterConfig
    ): IRAction[] {
        const childActions: IRAction[] = [];
        let currentRunAfter: RunAfterConfig = {};

        for (const child of shape.children) {
            // Skip unknown/unrecognized shape types inside ConstructMessage
            // (e.g. metadata elements that aren't real flow shapes)
            if (child.type === 'Unknown') {
                continue;
            }

            const result = this.convertShapeToIR(child, null, new ParseErrorAccumulator(100));

            for (const action of result.actions) {
                childActions.push({
                    ...action,
                    runAfter: currentRunAfter,
                } as IRAction);
                currentRunAfter = { [action.id]: ['Succeeded'] };
            }
        }

        // Always create a ConstructMessage wrapper action that contains children
        // This preserves the shape hierarchy and makes it clear to the LLM
        const constructAction = {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'compose' as ActionType,
            description:
                shape.description ||
                `Construct message: ${shape.constructedMessages.join(', ') || 'unknown'}`,
            runAfter,
            config: {},
            actions: childActions,
            sourceMapping: {
                biztalk: {
                    shapeType: 'ConstructMessage',
                    constructedMessages: shape.constructedMessages,
                    childShapes: childActions.map((a) => {
                        const sm = a.sourceMapping as
                            | { biztalk?: { shapeType?: string } }
                            | undefined;
                        return `${sm?.biztalk?.shapeType || a.type}: ${a.name}`;
                    }),
                },
            },
        } as unknown as IRAction;

        return [constructAction];
    }

    /**
     * Create expression action.
     */
    private createExpressionAction(shape: BizTalkShape, runAfter: RunAfterConfig): IRAction {
        const expressionShape = shape as BizTalkExpressionShape;
        const expression = expressionShape.expression || '';

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'compose' as ActionType,
            description: shape.description || 'Expression',
            runAfter,
            config: {
                inputs: expression,
            },
            sourceMapping: {
                biztalk: {
                    shapeType: shape.type,
                    expression,
                },
            },
        } as unknown as IRAction;
    }

    /**
     * Create condition action.
     */
    private createConditionAction(
        shape: BizTalkDecideShape,
        runAfter: RunAfterConfig,
        errors: ParseErrorAccumulator
    ): IRAction {
        // Convert branches to condition structure
        const cases: { condition: string; actions: IRAction[] }[] = [];
        let defaultBranch: IRAction[] | undefined = undefined;

        for (const branch of shape.branches) {
            const branchActions: IRAction[] = [];

            for (const child of branch.children) {
                const result = this.convertShapeToIR(child, null, errors);
                branchActions.push(...result.actions);
            }

            if (branch.isElse) {
                defaultBranch = branchActions;
            } else {
                cases.push({
                    condition: branch.condition || '',
                    actions: branchActions,
                });
            }
        }

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'condition' as ActionType,
            description: shape.description || 'Decision',
            runAfter,
            config: {
                expression: cases[0]?.condition || '',
            },
            branches: {
                true: cases[0]?.actions || [],
                false: defaultBranch || [],
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Decide',
                    branchCount: shape.branches.length,
                },
            },
            targetMapping: {
                logicAppsAction: 'Condition',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }

    /**
     * Create until (loop) action.
     */
    private createUntilAction(
        shape: BizTalkLoopShape,
        runAfter: RunAfterConfig,
        errors: ParseErrorAccumulator
    ): IRAction {
        const bodyActions: IRAction[] = [];

        for (const child of shape.children) {
            const result = this.convertShapeToIR(child, null, errors);
            bodyActions.push(...result.actions);
        }

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'until' as ActionType,
            description: shape.description || 'Loop',
            runAfter,
            config: {
                expression: shape.condition,
                limit: {
                    count: 60,
                    timeout: 'PT1H',
                },
            },
            actions: bodyActions,
            sourceMapping: {
                biztalk: {
                    shapeType: 'Loop',
                    condition: shape.condition,
                },
            },
            targetMapping: {
                logicAppsAction: 'Until',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }

    /**
     * Create parallel action.
     */
    private createParallelAction(
        shape: BizTalkParallelShape,
        runAfter: RunAfterConfig,
        errors: ParseErrorAccumulator
    ): IRAction {
        const branches: { name: string; actions: IRAction[] }[] = [];

        for (const branch of shape.branches) {
            const branchActions: IRAction[] = [];

            for (const child of branch.children) {
                const result = this.convertShapeToIR(child, null, errors);
                branchActions.push(...result.actions);
            }

            branches.push({
                name: branch.name,
                actions: branchActions,
            });
        }

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'parallel' as ActionType,
            description: shape.description || 'Parallel actions',
            runAfter,
            config: {},
            branches,
            sourceMapping: {
                biztalk: {
                    shapeType: 'Parallel',
                    branchCount: shape.branches.length,
                },
            },
            targetMapping: {
                logicAppsAction: 'Parallel_branches',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }

    /**
     * Create scope action.
     */
    private createScopeAction(
        shape: BizTalkScopeShape,
        runAfter: RunAfterConfig,
        errors: ParseErrorAccumulator
    ): IRAction {
        const bodyActions: IRAction[] = [];

        for (const child of shape.children) {
            const result = this.convertShapeToIR(child, null, errors);
            bodyActions.push(...result.actions);
        }

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: 'scope' as ActionType,
            description: shape.description || 'Scope',
            runAfter,
            config: {
                transactionType: shape.transactionType,
            },
            actions: bodyActions,
            sourceMapping: {
                biztalk: {
                    shapeType: 'Scope',
                    transactionType: shape.transactionType,
                    exceptionHandlerCount: shape.exceptionHandlers.length,
                },
            },
            targetMapping: {
                logicAppsAction: 'Scope',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }

    /**
     * Create delay action.
     */
    private createDelayAction(shape: BizTalkDelayShape, runAfter: RunAfterConfig): IRAction {
        const actionType = shape.isDelayUntil ? 'delay-until' : 'delay';

        return {
            id: `action-${shape.name}`,
            name: shape.name,
            type: actionType as ActionType,
            description: shape.description || 'Delay',
            runAfter,
            config: {
                duration: shape.delayExpression,
            },
            sourceMapping: {
                biztalk: {
                    shapeType: 'Delay',
                    expression: shape.delayExpression,
                    isDelayUntil: shape.isDelayUntil,
                },
            },
            targetMapping: {
                logicAppsAction: shape.isDelayUntil ? 'Delay_until' : 'Delay',
                confidence: 'high',
            },
        } as unknown as IRAction;
    }
}
