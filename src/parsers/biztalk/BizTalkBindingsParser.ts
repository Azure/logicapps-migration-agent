/**
 * BizTalk Bindings Parser
 *
 * Parses BizTalk binding files (BindingInfo.xml) into IR format.
 *
 * @module parsers/biztalk/BizTalkBindingsParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { ParsedArtifact } from '../../stages/discovery/types';
import { LoggingService } from '../../services/LoggingService';
import { enrichConnectionsFromBindings } from './BizTalkPostEnrichment';
import {
    BizTalkBindingInfo,
    BizTalkReceivePort,
    BizTalkReceiveLocation,
    BizTalkSendPort,
    BizTalkSendPortGroup,
    BizTalkOrchestrationBinding,
    BizTalkAdapterType,
    BizTalkPortBinding,
} from './types';
import {
    parseXml,
    getAttr,
    getAllElements,
    getElementText,
    getAllChildElements,
} from '../utils/xml';
import {
    IRDocument,
    createEmptyIRDocument,
    IRConnection,
    IRReceiveEndpoint,
    IRSendEndpoint,
    IREndpointsConfig,
    ConnectionType,
    SourceFileType,
} from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// Adapter Type Mapping
// =============================================================================

const ADAPTER_TYPE_MAP: Record<string, BizTalkAdapterType> = {
    FILE: 'FILE',
    HTTP: 'HTTP',
    SOAP: 'SOAP',
    SQL: 'SQL',
    FTP: 'FTP',
    SFTP: 'SFTP',
    MSMQ: 'MSMQ',
    MQSeries: 'MQSeries',
    'WCF-BasicHttp': 'WCF-BasicHttp',
    'WCF-WSHttp': 'WCF-WSHttp',
    'WCF-NetTcp': 'WCF-NetTcp',
    'WCF-Custom': 'WCF-Custom',
    'WCF-CustomIsolated': 'WCF-CustomIsolated',
    'WCF-SQL': 'WCF-SQL',
    'WCF-SAP': 'WCF-SAP',
    'WCF-OracleDB': 'WCF-OracleDB',
    'WCF-Siebel': 'WCF-Siebel',
    'SB-Messaging': 'SB-Messaging',
    SharePoint: 'SharePoint',
    POP3: 'POP3',
    SMTP: 'SMTP',
    Office365: 'Office365',
};

// =============================================================================
// BizTalk Bindings Parser
// =============================================================================

/**
 * Parser for BizTalk binding files.
 */
export class BizTalkBindingsParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.xml'],
        fileTypes: ['binding' as SourceFileType],
        supportsFolder: false,
        description: 'Parses BizTalk binding files into IR connections and endpoints',
    };

    /**
     * Check if this is a bindings file.
     * Matches files with "binding" in name OR common deployment environment names.
     */
    override canParse(filePath: string): boolean {
        if (!filePath.toLowerCase().endsWith('.xml')) {
            return false;
        }

        const fileName = path.basename(filePath).toLowerCase();
        const fileNameWithoutExt = fileName.replace('.xml', '');
        const parentFolder = path.basename(path.dirname(filePath)).toLowerCase();

        // Check for "binding" in filename
        if (fileName.includes('binding')) {
            return true;
        }

        // Check for environment-specific binding files (common BizTalk pattern)
        // e.g., production.xml, staging.xml
        const environmentNames = ['production', 'staging', 'develop', 'dev', 'qa', 'uat', 'prod'];
        if (environmentNames.includes(fileNameWithoutExt)) {
            return true;
        }

        // Check for pattern where folder name matches file name (e.g., production/production.xml)
        if (environmentNames.includes(parentFolder) && parentFolder === fileNameWithoutExt) {
            return true;
        }

        // Check for BindingImport in path (common BizTalk pattern)
        if (filePath.toLowerCase().includes('bindingimport')) {
            return true;
        }

        return false;
    }

    /**
     * Additional check by reading file content for BindingInfo root element.
     * Called when canParse returns false but we want to double-check.
     */
    public async canParseByContent(filePath: string): Promise<boolean> {
        if (!filePath.toLowerCase().endsWith('.xml')) {
            return false;
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            // Quick check without full XML parsing
            return content.includes('<BindingInfo') && content.includes('xmlns');
        } catch {
            return false;
        }
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
        this.reportProgress(
            options.onProgress,
            1,
            3,
            `Reading bindings: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Binding file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing binding structure');

        // Parse binding info
        const bindingInfo = this.parseBindingXml(doc, inputPath, errors);
        if (!bindingInfo) {
            return null;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Binding parsing complete');

        // Convert to IR
        return this.convertToIR(bindingInfo, errors);
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'binding',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'binding',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const bindingInfo = this.parseBindingXml(doc, filePath, errors);

        if (!bindingInfo) {
            return {
                name: path.basename(filePath, '.xml'),
                type: 'binding',
            };
        }

        return {
            name: `${path.basename(filePath, '.xml')}${bindingInfo.applicationName !== path.basename(filePath, '.xml') ? ` (${bindingInfo.applicationName})` : ''}`,
            type: 'binding',
            elementCount:
                bindingInfo.receivePorts.length +
                bindingInfo.sendPorts.length +
                bindingInfo.sendPortGroups.length,
            description: `${bindingInfo.receivePorts.length} receive ports, ${bindingInfo.sendPorts.length} send ports`,
        };
    }

    // =========================================================================
    // Binding XML Parsing
    // =========================================================================

    /**
     * Parse binding XML document.
     */
    private parseBindingXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): BizTalkBindingInfo | null {
        const rootElement = doc.documentElement;

        if (!rootElement || rootElement.tagName !== 'BindingInfo') {
            // Try to find BindingInfo element
            const bindingInfoElements = getAllElements(rootElement || doc, 'BindingInfo');
            if (bindingInfoElements.length === 0) {
                errors.addError(
                    ParseErrorCodes.INVALID_BINDING,
                    'File does not contain BizTalk binding information',
                    { filePath }
                );
                return null;
            }
        }

        const bindingRoot =
            rootElement?.tagName === 'BindingInfo'
                ? rootElement
                : getAllElements(doc, 'BindingInfo')[0];

        const applicationName =
            getAttr(bindingRoot, 'ApplicationName') || path.basename(filePath, '.xml');

        // The Assembly attribute (e.g. "Microsoft.BizTalk.Deployment, Version=3.0.1.0...")
        // is NOT the application name — it's the BizTalk deployment assembly info.
        // We intentionally skip it to avoid all bindings showing the same name.

        // Parse receive ports
        const receivePorts = this.parseReceivePorts(bindingRoot, errors);

        // Parse send ports
        const sendPorts = this.parseSendPorts(bindingRoot, errors);

        // Parse send port groups
        const sendPortGroups = this.parseSendPortGroups(bindingRoot, errors);

        // Parse orchestration bindings
        const orchestrationBindings = this.parseOrchestrationBindings(bindingRoot, errors);

        return {
            applicationName,
            filePath,
            receivePorts,
            sendPorts,
            sendPortGroups,
            orchestrationBindings,
        };
    }

    /**
     * Parse receive ports.
     */
    private parseReceivePorts(
        bindingRoot: Element,
        errors: ParseErrorAccumulator
    ): BizTalkReceivePort[] {
        const ports: BizTalkReceivePort[] = [];
        const portElements = getAllElements(bindingRoot, 'ReceivePort');

        for (const portEl of portElements) {
            const name = getAttr(portEl, 'Name') || 'UnknownReceivePort';
            const isTwoWay = getAttr(portEl, 'IsTwoWay') === 'true';
            const routeFailedMessage = getAttr(portEl, 'RouteFailedMessage') === 'true';
            const authentication = this.parseAuthentication(portEl);

            // Parse receive locations
            const locations = this.parseReceiveLocations(portEl, name, errors);

            // Parse maps
            const inboundMaps = this.parseMaps(portEl, 'InboundTransforms');
            const outboundMaps = this.parseMaps(portEl, 'OutboundTransforms');

            ports.push({
                name,
                isTwoWay,
                routeFailedMessage,
                authentication,
                locations,
                inboundMaps,
                outboundMaps,
            });
        }

        return ports;
    }

    /**
     * Parse receive locations.
     */
    private parseReceiveLocations(
        portEl: Element,
        receivePortName: string,
        _errors: ParseErrorAccumulator
    ): BizTalkReceiveLocation[] {
        const locations: BizTalkReceiveLocation[] = [];
        const locationElements = getAllElements(portEl, 'ReceiveLocation');

        for (const locEl of locationElements) {
            const name = getAttr(locEl, 'Name') || 'UnknownLocation';
            const address = getAttr(locEl, 'Address') || getElementText(locEl, 'Address') || '';
            const enabled = getAttr(locEl, 'Enable') !== 'false';

            // Get transport type — BizTalk uses <ReceiveLocationTransportType Name="FILE"/>
            // or <TransportType Name="FILE"/> in some exports
            const transportTypeData =
                this.getChildElementName(locEl, 'ReceiveLocationTransportType') ||
                this.getChildElementName(locEl, 'TransportType') ||
                getElementText(locEl, 'ReceiveLocationTransportType') ||
                getElementText(locEl, 'TransportType') ||
                getAttr(locEl, 'TransportType') ||
                '';
            const transportType = this.parseAdapterType(transportTypeData);

            // Get pipeline names — BizTalk uses <ReceivePipeline Name="..."/>
            const receivePipeline =
                this.getChildElementName(locEl, 'ReceivePipeline') ||
                getElementText(locEl, 'ReceivePipeline') ||
                getAttr(locEl, 'ReceivePipeline') ||
                'XMLReceive';
            const sendPipeline =
                this.getChildElementName(locEl, 'SendPipeline') ||
                getElementText(locEl, 'SendPipeline') ||
                getAttr(locEl, 'SendPipeline');

            // Parse transport config
            const transportConfig = this.parseTransportConfig(locEl);

            locations.push({
                name,
                receivePortName,
                transportType,
                address,
                receivePipeline,
                sendPipeline,
                enabled,
                transportConfig,
            });
        }

        return locations;
    }

    /**
     * Parse send ports.
     */
    private parseSendPorts(
        bindingRoot: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkSendPort[] {
        const ports: BizTalkSendPort[] = [];
        const portElements = getAllElements(bindingRoot, 'SendPort');

        for (const portEl of portElements) {
            const name = getAttr(portEl, 'Name') || 'UnknownSendPort';
            const isTwoWay = getAttr(portEl, 'IsTwoWay') === 'true';
            const isDynamic = getAttr(portEl, 'IsDynamic') === 'true';

            // Get transport info — BizTalk nests transport inside <PrimaryTransport>
            // <PrimaryTransport><TransportType Name="FILE" .../></PrimaryTransport>
            // Also try direct child for simplified exports
            const primaryTransport = this.getFirstDescendantElement(portEl, 'PrimaryTransport');
            const transportTypeData = primaryTransport
                ? this.getChildElementName(primaryTransport, 'TransportType') || ''
                : this.getChildElementName(portEl, 'TransportType') ||
                  getElementText(portEl, 'TransportType') ||
                  getAttr(portEl, 'TransportType') ||
                  '';
            const transportType = this.parseAdapterType(transportTypeData);

            // Address can be in <PrimaryTransport><Address> or directly on <SendPort>
            const address =
                (primaryTransport ? getElementText(primaryTransport, 'Address') : undefined) ||
                getElementText(portEl, 'Address') ||
                getAttr(portEl, 'Address') ||
                '';

            // Get pipelines — BizTalk SendPort uses <TransmitPipeline Name="..."/>
            // (NOT <SendPipeline> — that element is only in ReceiveLocation for two-way)
            const sendPipeline =
                this.getChildElementName(portEl, 'TransmitPipeline') ||
                this.getChildElementName(portEl, 'SendPipeline') ||
                getElementText(portEl, 'TransmitPipeline') ||
                getElementText(portEl, 'SendPipeline') ||
                getAttr(portEl, 'SendPipeline') ||
                'PassThruTransmit';
            const receivePipeline =
                this.getChildElementName(portEl, 'ReceivePipeline') ||
                getElementText(portEl, 'ReceivePipeline') ||
                getAttr(portEl, 'ReceivePipeline');

            // Get filter
            const filter = getElementText(portEl, 'Filter') || getAttr(portEl, 'Filter');

            // Parse transport config
            const transportConfig = this.parseTransportConfig(portEl);

            // Parse maps
            const inboundMaps = this.parseMaps(portEl, 'InboundTransforms');
            const outboundMaps = this.parseMaps(portEl, 'OutboundTransforms');

            ports.push({
                name,
                isTwoWay,
                isDynamic,
                transportType,
                address,
                sendPipeline,
                receivePipeline,
                filter,
                transportConfig,
                inboundMaps,
                outboundMaps,
            });
        }

        return ports;
    }

    /**
     * Parse send port groups.
     */
    private parseSendPortGroups(
        bindingRoot: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkSendPortGroup[] {
        const groups: BizTalkSendPortGroup[] = [];
        const groupElements = getAllElements(bindingRoot, 'SendPortGroup');

        for (const groupEl of groupElements) {
            const name = getAttr(groupEl, 'Name') || 'UnknownGroup';
            const filter = getElementText(groupEl, 'Filter') || getAttr(groupEl, 'Filter');

            // Parse member send ports
            const sendPorts: string[] = [];
            const memberElements = getAllElements(groupEl, 'SendPortRef');
            for (const memberEl of memberElements) {
                const portName = getAttr(memberEl, 'Name') || memberEl.textContent;
                if (portName) {
                    sendPorts.push(portName.trim());
                }
            }

            groups.push({
                name,
                sendPorts,
                filter,
            });
        }

        return groups;
    }

    /**
     * Parse orchestration bindings.
     */
    private parseOrchestrationBindings(
        bindingRoot: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkOrchestrationBinding[] {
        const bindings: BizTalkOrchestrationBinding[] = [];
        const bindingElements = getAllElements(bindingRoot, 'ModuleRef');

        for (const moduleEl of bindingElements) {
            const assemblyName = getAttr(moduleEl, 'Name') || '';

            // Find service (orchestration) bindings
            const serviceElements = getAllElements(moduleEl, 'Services');
            for (const serviceContainer of serviceElements) {
                const services = getAllElements(serviceContainer, 'Service');

                for (const serviceEl of services) {
                    const orchName = getAttr(serviceEl, 'Name') || '';
                    const hostName = getAttr(serviceEl, 'Host') || '';

                    // Parse port bindings
                    const portBindings: BizTalkPortBinding[] = [];
                    const portElements = getAllElements(serviceEl, 'Ports');

                    for (const portContainer of portElements) {
                        const ports = getAllElements(portContainer, 'Port');

                        for (const portEl of ports) {
                            const portName = getAttr(portEl, 'Name') || '';
                            // BizTalk uses child elements: <ReceivePortRef Name="..."/>, <SendPortRef Name="..."/>
                            const receivePortRef = this.getChildElementName(
                                portEl,
                                'ReceivePortRef'
                            );
                            const sendPortRef = this.getChildElementName(portEl, 'SendPortRef');
                            const sendPortGroupRef = this.getChildElementName(
                                portEl,
                                'SendPortGroupRef'
                            );
                            const boundTo =
                                receivePortRef ||
                                sendPortRef ||
                                sendPortGroupRef ||
                                // Fallback: try as attributes
                                getAttr(portEl, 'ReceivePortRef') ||
                                getAttr(portEl, 'SendPortRef') ||
                                getAttr(portEl, 'SendPortGroupRef');
                            const isSendPortGroup =
                                !!sendPortGroupRef || getAttr(portEl, 'SendPortGroupRef') !== null;

                            const bindingOption = parseInt(
                                getAttr(portEl, 'BindingOption') || '0',
                                10
                            );
                            portBindings.push({
                                portName,
                                boundTo,
                                isSendPortGroup,
                                bindingOption,
                            });
                        }
                    }

                    if (orchName) {
                        bindings.push({
                            orchestrationName: orchName,
                            assemblyName,
                            hostName,
                            portBindings,
                        });
                    }
                }
            }
        }

        return bindings;
    }

    /**
     * Get the Name attribute from a descendant element.
     * BizTalk binding XML stores many values as child elements with Name attributes,
     * e.g. <TransportType Name="FILE"/>, <TransmitPipeline Name="XMLTransmit"/>.
     */
    private getChildElementName(parent: Element, tagName: string): string | undefined {
        const children = getAllElements(parent, tagName);
        if (children.length > 0) {
            return getAttr(children[0], 'Name') || undefined;
        }
        return undefined;
    }

    /**
     * Get first descendant element with given tag name.
     */
    private getFirstDescendantElement(parent: Element, tagName: string): Element | undefined {
        const children = getAllElements(parent, tagName);
        return children.length > 0 ? children[0] : undefined;
    }

    /**
     * Parse adapter type from string.
     */
    private parseAdapterType(typeData: string): BizTalkAdapterType {
        for (const [key, value] of Object.entries(ADAPTER_TYPE_MAP)) {
            if (typeData.includes(key)) {
                return value;
            }
        }
        // Return the raw adapter name for custom/third-party adapters
        // rather than losing the information by returning 'Unknown'
        return (typeData.trim() || 'Unknown') as BizTalkAdapterType;
    }

    /**
     * Parse authentication type.
     */
    private parseAuthentication(portEl: Element): 'none' | 'drop' | 'require' {
        const auth =
            getAttr(portEl, 'Authentication') || getElementText(portEl, 'Authentication') || 'None';

        if (auth.toLowerCase().includes('drop')) {
            return 'drop';
        }
        if (auth.toLowerCase().includes('require')) {
            return 'require';
        }
        return 'none';
    }

    /**
     * Parse transport configuration.
     */
    private parseTransportConfig(element: Element): Record<string, unknown> {
        const config: Record<string, unknown> = {};

        // Look for TransportTypeData or CustomProps
        const transportDataElements = getAllElements(element, 'TransportTypeData');
        const customPropsElements = getAllElements(element, 'CustomProps');

        for (const dataEl of [...transportDataElements, ...customPropsElements]) {
            const text = dataEl.textContent;
            if (text) {
                try {
                    // Try to parse as XML
                    const configDoc = parseXml(text);
                    if (configDoc) {
                        this.extractConfigProperties(configDoc.documentElement, config);
                    }
                } catch {
                    // Store as raw text
                    config.raw = text;
                }
            }
        }

        return config;
    }

    /**
     * Extract configuration properties from XML element.
     */
    private extractConfigProperties(element: Element, config: Record<string, unknown>): void {
        const children = getAllChildElements(element);

        for (const child of children) {
            const name = child.tagName;
            const text = child.textContent?.trim();
            const vtype = getAttr(child, 'vt');

            if (text) {
                // Try to parse as appropriate type
                if (vtype === '11') {
                    config[name] = text.toLowerCase() === 'true' || text === '-1';
                } else if (vtype === '3' || vtype === '19') {
                    config[name] = parseInt(text, 10);
                } else {
                    config[name] = text;
                }
            }
        }
    }

    /**
     * Parse map references.
     */
    private parseMaps(element: Element, elementName: string): string[] {
        const maps: string[] = [];
        const transformsElements = getAllElements(element, elementName);

        for (const transforms of transformsElements) {
            const transforms2 = getAllElements(transforms, 'Transform');
            for (const transform of transforms2) {
                const mapName =
                    getAttr(transform, 'AssemblyQualifiedName') ||
                    getAttr(transform, 'Name') ||
                    transform.textContent;
                if (mapName) {
                    maps.push(mapName.trim());
                }
            }
        }

        return maps;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert binding info to IR document.
     */
    private convertToIR(
        bindingInfo: BizTalkBindingInfo,
        _errors: ParseErrorAccumulator
    ): IRDocument {
        const fileName = path.basename(bindingInfo.filePath, '.xml');
        // Use filename as the display name so each binding file is distinguishable
        // in the artifact inventory tree. Append application name if it differs.
        const displayName =
            bindingInfo.applicationName !== fileName
                ? `${fileName} (${bindingInfo.applicationName})`
                : fileName;

        const ir = createEmptyIRDocument(`binding-${fileName}`, displayName, 'biztalk');

        // Convert to connections
        const connections = this.createConnections(bindingInfo);

        // Create endpoints config
        const endpoints = this.createEndpointsConfig(bindingInfo);

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    application: bindingInfo.applicationName,
                    artifact: {
                        name: bindingInfo.applicationName,
                        type: 'binding',
                        filePath: bindingInfo.filePath,
                        fileType: '.xml',
                    },
                },
            },
            connections,
            endpoints,
            extensions: {
                biztalk: {
                    applicationName: bindingInfo.applicationName,
                    receivePortCount: bindingInfo.receivePorts.length,
                    sendPortCount: bindingInfo.sendPorts.length,
                    sendPortGroupCount: bindingInfo.sendPortGroups.length,
                    orchestrationBindings: bindingInfo.orchestrationBindings.map((o) => ({
                        orchestrationName: o.orchestrationName,
                        portBindings: o.portBindings.map((pb) => ({
                            portName: pb.portName,
                            boundTo: pb.boundTo,
                            isSendPortGroup: pb.isSendPortGroup,
                            bindingOption: pb.bindingOption,
                        })),
                    })),
                    receivePortDetails: bindingInfo.receivePorts.map((rp) => ({
                        name: rp.name,
                        routeFailedMessage: rp.routeFailedMessage,
                        isTwoWay: rp.isTwoWay,
                        inboundMaps: rp.inboundMaps,
                        outboundMaps: rp.outboundMaps,
                    })),
                },
            },
        };
    }

    /**
     * Create IR connections from bindings.
     */
    private createConnections(bindingInfo: BizTalkBindingInfo): IRConnection[] {
        const connections: IRConnection[] = [];
        const seenTypes = new Set<string>();

        // Extract unique adapter types from all locations and ports
        for (const rp of bindingInfo.receivePorts) {
            for (const loc of rp.locations) {
                if (!seenTypes.has(loc.transportType)) {
                    seenTypes.add(loc.transportType);
                    const conn = this.createConnectionForAdapter(loc.transportType, loc);
                    if (conn) {
                        connections.push(conn);
                    }
                }
            }
        }

        for (const sp of bindingInfo.sendPorts) {
            if (!seenTypes.has(sp.transportType)) {
                seenTypes.add(sp.transportType);
                const conn = this.createConnectionForAdapter(sp.transportType, sp);
                if (conn) {
                    connections.push(conn);
                }
            }
        }

        return connections;
    }

    /**
     * Create connection for adapter type.
     */
    private createConnectionForAdapter(
        adapterType: BizTalkAdapterType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: any
    ): IRConnection | null {
        const connectionType = this.mapAdapterToConnectionType(adapterType);
        if (!connectionType) {
            return null;
        }

        return {
            id: `conn-${adapterType.toLowerCase()}`,
            name: `${adapterType} Connection`,
            type: connectionType,
            category: this.getConnectionCategory(adapterType),
            config: source.transportConfig || {},
            sourceMapping: {
                biztalk: {
                    adapterType,
                    address: source.address,
                },
            },
            targetMapping: {
                logicAppsConnector: this.mapAdapterToConnector(adapterType),
                confidence: this.getConfidenceForAdapter(adapterType),
            },
        } as unknown as IRConnection;
    }

    /**
     * Map adapter to connection type.
     */
    private mapAdapterToConnectionType(adapter: BizTalkAdapterType): ConnectionType | null {
        switch (adapter) {
            case 'FILE':
                return 'file-system';
            case 'HTTP':
            case 'SOAP':
            case 'WCF-BasicHttp':
            case 'WCF-WSHttp':
                return 'http';
            case 'SQL':
            case 'WCF-SQL':
                return 'sql-server';
            case 'WCF-SAP':
                return 'sap';
            case 'WCF-OracleDB':
                return 'oracle';
            case 'FTP':
                return 'ftp';
            case 'SFTP':
                return 'sftp';
            case 'SB-Messaging':
                return 'service-bus';
            case 'SMTP':
                return 'smtp';
            default:
                return 'custom';
        }
    }

    /**
     * Get connection category for adapter.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getConnectionCategory(adapter: BizTalkAdapterType): any {
        switch (adapter) {
            case 'SQL':
            case 'WCF-SQL':
            case 'WCF-OracleDB':
                return 'database';
            case 'SB-Messaging':
            case 'MSMQ':
            case 'MQSeries':
                return 'messaging';
            case 'FILE':
            case 'FTP':
            case 'SFTP':
                return 'storage';
            case 'WCF-SAP':
            case 'WCF-Siebel':
                return 'erp';
            default:
                return 'api';
        }
    }

    /**
     * Map adapter to Logic Apps connector name.
     */
    private mapAdapterToConnector(adapter: BizTalkAdapterType): string {
        switch (adapter) {
            case 'FILE':
                return 'azureblob'; // or filesystem
            case 'SQL':
            case 'WCF-SQL':
                return 'sql';
            case 'WCF-SAP':
                return 'sap';
            case 'WCF-OracleDB':
                return 'oracle';
            case 'FTP':
                return 'ftp';
            case 'SFTP':
                return 'sftp';
            case 'SB-Messaging':
                return 'servicebus';
            case 'HTTP':
            case 'SOAP':
            case 'WCF-BasicHttp':
            case 'WCF-WSHttp':
                return 'http';
            case 'SMTP':
                return 'smtp';
            default:
                return 'custom';
        }
    }

    /**
     * Get confidence for adapter mapping.
     */
    private getConfidenceForAdapter(adapter: BizTalkAdapterType): 'high' | 'medium' | 'low' {
        switch (adapter) {
            case 'HTTP':
            case 'SQL':
            case 'WCF-SQL':
            case 'SB-Messaging':
            case 'FTP':
            case 'SFTP':
                return 'high';
            case 'WCF-SAP':
            case 'WCF-OracleDB':
            case 'FILE':
            case 'SMTP':
                return 'medium';
            default:
                return 'low';
        }
    }

    /**
     * Create endpoints configuration.
     */
    private createEndpointsConfig(bindingInfo: BizTalkBindingInfo): IREndpointsConfig {
        const receiveEndpoints: IRReceiveEndpoint[] = [];
        const sendEndpoints: IRSendEndpoint[] = [];

        // Convert receive ports/locations
        for (const rp of bindingInfo.receivePorts) {
            for (const loc of rp.locations) {
                receiveEndpoints.push({
                    id: `recv-${loc.name}`,
                    name: loc.name,
                    transport:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (this.mapAdapterToConnectionType(loc.transportType) as any) || 'custom',
                    address: loc.address,
                    pattern: rp.isTwoWay ? 'request-response' : 'one-way',
                    enabled: loc.enabled,
                    sourceMapping: {
                        biztalk: {
                            receivePortName: rp.name,
                            receiveLocationName: loc.name,
                            adapterType: loc.transportType,
                            pipeline: loc.receivePipeline,
                            sendPipeline: loc.sendPipeline,
                            isTwoWay: rp.isTwoWay,
                            routeFailedMessage: rp.routeFailedMessage,
                        },
                    },
                } as unknown as IRReceiveEndpoint);
            }
        }

        // Convert send ports
        for (const sp of bindingInfo.sendPorts) {
            sendEndpoints.push({
                id: `send-${sp.name}`,
                name: sp.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transport: (this.mapAdapterToConnectionType(sp.transportType) as any) || 'custom',
                address: sp.address,
                pattern: sp.isTwoWay ? 'solicit-response' : 'one-way',
                bindingType: sp.isDynamic ? 'dynamic' : 'static',
                filters: sp.filter
                    ? [{ property: 'custom', operator: 'equals', value: sp.filter }]
                    : [],
                sourceMapping: {
                    biztalk: {
                        sendPortName: sp.name,
                        adapterType: sp.transportType,
                        isDynamic: sp.isDynamic,
                        pipeline: sp.sendPipeline,
                        receivePipeline: sp.receivePipeline,
                        isTwoWay: sp.isTwoWay,
                        filter: sp.filter,
                    },
                },
            } as unknown as IRSendEndpoint);
        }

        return {
            receive: receiveEndpoints,
            send: sendEndpoints,
            sendGroups: bindingInfo.sendPortGroups.map((g) => ({
                id: `group-${g.name}`,
                name: g.name,
                sendEndpoints: g.sendPorts,
                filters: g.filter
                    ? [{ property: 'custom', operator: 'equals', value: g.filter }]
                    : [],
            })),
        } as unknown as IREndpointsConfig;
    }

    // =========================================================================
    // Post-Parse Enrichment
    // =========================================================================

    /**
     * Cross-reference binding connection/endpoint data into orchestration IRs.
     *
     * @see enrichConnectionsFromBindings
     */
    postEnrich(artifacts: ParsedArtifact[], logger: LoggingService): void {
        enrichConnectionsFromBindings(artifacts, logger);
    }
}
