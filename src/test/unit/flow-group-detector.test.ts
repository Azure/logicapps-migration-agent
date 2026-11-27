import * as assert from 'assert/strict';
import * as path from 'path';
import { createWorkspace, disposeWorkspace, discoverSample } from '../helpers/biztalk';
import { InventoryService } from '../../stages/discovery/InventoryService';
import {
    compareInventoryWithGroups,
    detectFlowGroups,
    findCrossGroupDependencies,
    findMissingProjectReferences,
    findUndeclaredSharedArtifacts,
    humanizeName,
    resolveGroupingMode,
    scopeEndpointsToFlow,
    simpleName,
    subscribedReceivePorts,
} from '../../stages/discovery/FlowGroupDetector';
import { ArtifactCategory, ParsedArtifact } from '../../stages/discovery/types';
import { createEmptyIRDocument, IRDocument } from '../../ir/types';
import { LLMFlowGenerator } from '../../services/LLMFlowGenerator';

const appRoot = path.resolve('/contoso-app');

function artifact(
    id: string,
    name: string,
    type: ArtifactCategory,
    relativePath: string,
    ir: Record<string, unknown> = {}
): ParsedArtifact {
    return {
        id,
        name,
        type,
        sourcePath: relativePath,
        absolutePath: path.join(appRoot, relativePath),
        ir: { ...createEmptyIRDocument(id, name, 'biztalk'), ...ir } as unknown as IRDocument,
        fileSize: 1,
        lastModified: '2026-01-01T00:00:00.000Z',
        parserId: 'test',
    };
}

const transform = (mapTypeName: string) => ({
    type: 'compose',
    actions: [
        {
            type: 'transform',
            config: { mapReference: mapTypeName },
            sourceMapping: { biztalk: { shapeType: 'Transform', mapTypeName } },
        },
    ],
});

const receive = (name: string, port: string, extra: Record<string, unknown> = {}) => ({
    name,
    sourceMapping: { biztalk: { receivePortName: port, adapterType: 'FILE', ...extra } },
});

const send = (name: string, adapterType: string, filter?: string) => ({
    name,
    sourceMapping: { biztalk: { adapterType, ...(filter ? { filter } : {}) } },
});

/** A BizTalk application with shared canonical schemas and one binding file for several flows. */
function sampleApplication(): ParsedArtifact[] {
    return [
        artifact(
            'orch-invoice',
            'InvoiceNotification',
            'orchestration',
            'Orchestrations/InvoiceNotification.odx',
            {
                actions: [
                    transform('Contoso.Maps.InvoiceToNotification'),
                    {
                        type: 'call-workflow',
                        sourceMapping: {
                            biztalk: {
                                shapeType: 'CallOrchestration',
                                calledOrchestration: 'Contoso.Orchestrations.SendNotification',
                            },
                        },
                    },
                ],
                extensions: {
                    biztalk: {
                        orchestrationName: 'InvoiceNotification',
                        namespace: 'Contoso.Orchestrations',
                        messageTypes: [
                            'Contoso.Cdm.Invoice',
                            'Contoso.Schemas.Notification',
                            'System.Xml.XmlDocument',
                        ],
                    },
                },
            }
        ),
        artifact(
            'orch-send',
            'SendNotification',
            'orchestration',
            'Orchestrations/SendNotification.odx'
        ),
        artifact(
            'orch-customer',
            'CustomerSync',
            'orchestration',
            'Orchestrations/CustomerSync.odx',
            {
                actions: [transform('Contoso.Maps.InvoiceToCustomer')],
                extensions: {
                    biztalk: { messageTypes: ['Contoso.Cdm.Invoice', 'Contoso.Schemas.Customer'] },
                },
            }
        ),
        artifact(
            'map-notification',
            'InvoiceToNotification',
            'map',
            'Maps/InvoiceToNotification.btm',
            {
                maps: [
                    {
                        id: 'm1',
                        name: 'InvoiceToNotification',
                        sourceSchema: 'Contoso.Cdm.Invoice',
                        targetSchema: 'Contoso.Schemas.Notification',
                    },
                ],
            }
        ),
        artifact('map-customer', 'InvoiceToCustomer', 'map', 'Maps/InvoiceToCustomer.btm', {
            maps: [
                {
                    id: 'm2',
                    name: 'InvoiceToCustomer',
                    sourceSchema: '..\\Cdm\\Invoice.xsd',
                    targetSchema: 'Contoso.Schemas.Customer',
                },
            ],
        }),
        artifact('schema-invoice', 'Invoice', 'schema', 'Cdm/Invoice.xsd'),
        artifact('schema-notification', 'Notification', 'schema', 'Schemas/Notification.xsd'),
        artifact('schema-customer', 'Customer', 'schema', 'Schemas/Customer.xsd'),
        artifact('schema-unused', 'Unused', 'schema', 'Schemas/Unused.xsd'),
        artifact('pipeline-receive', 'RcvInvoice', 'pipeline', 'Pipelines/RcvInvoice.btp'),
        artifact(
            'project-orchestrations',
            'Orchestrations',
            'custom-code',
            'Orchestrations/Orchestrations.btproj',
            {
                extensions: {
                    biztalk: {
                        projectReferences: [
                            path.join(appRoot, 'Cdm', 'Cdm.btproj'),
                            path.join(appRoot, 'Common', 'Common.btproj'),
                        ],
                    },
                },
            }
        ),
        artifact('project-cdm', 'Cdm', 'custom-code', 'Cdm/Cdm.btproj'),
        artifact('binding-app', 'Contoso.Application', 'binding', 'Deployment/Bindings.xml', {
            endpoints: {
                receive: [
                    receive('RL_Invoice_File', 'RP_Invoice', {
                        pipeline:
                            'Contoso.Pipelines.RcvInvoice, Contoso.Pipelines, Version=1.0.0.0, Culture=neutral',
                    }),
                    receive('RL_Customer_File', 'RP_Customer'),
                    receive('RL_Archive', 'RP_Archive'),
                    receive('RL_Orphan', 'RP_Orphan'),
                ],
                send: [
                    send('SP_Notification_SB', 'SB-Messaging'),
                    send(
                        'SP_Customer_Out',
                        'FILE',
                        '<?xml version="1.0"?><Filter><Group><Statement Property="BTS.ReceivePortName" Operator="0" Value="RP_Customer" /></Group></Filter>'
                    ),
                    send('SP_Archive', 'FILE', 'BTS.ReceivePortName == RP_Archive'),
                ],
            },
            extensions: {
                biztalk: {
                    orchestrationBindings: [
                        {
                            orchestrationName: 'Contoso.Orchestrations.InvoiceNotification',
                            portBindings: [
                                { portName: 'ReceiveInvoice', boundTo: 'RP_Invoice' },
                                { portName: 'SendNotification', boundTo: 'SP_Notification_SB' },
                            ],
                        },
                    ],
                },
            },
        }),
    ];
}

describe('Deterministic flow group detection', () => {
    it('groups call chains and messaging routes, sharing canonical schemas and bindings', () => {
        const result = detectFlowGroups(sampleApplication());

        assert.equal(result.detectionMode, 'deterministic');
        assert.deepEqual(
            result.groups.map((group) => [group.id, group.name]),
            [
                ['flow-customersync', 'Customer Sync'],
                ['flow-invoicenotification', 'Invoice Notification'],
                ['flow-rp-archive', 'RP Archive Route'],
                ['flow-rp-customer', 'RP Customer Route'],
            ]
        );

        const invoice = result.groups.find((group) => group.id === 'flow-invoicenotification');
        assert.ok(invoice);
        assert.deepEqual(invoice.artifactIds, [
            'binding-app',
            'map-notification',
            'orch-invoice',
            'orch-send',
            'pipeline-receive',
            'project-cdm',
            'project-orchestrations',
            'schema-invoice',
            'schema-notification',
        ]);
        assert.deepEqual(invoice.endpointNames, [
            'RL_Invoice_File',
            'RP_Invoice',
            'SP_Notification_SB',
        ]);
        assert.deepEqual(invoice.entryPoint, {
            type: 'receive-location',
            name: 'RL_Invoice_File',
        });
        assert.deepEqual(invoice.exitPoints, [{ type: 'send-port', name: 'SP_Notification_SB' }]);
        assert.equal(invoice.category, 'message-flow');
        assert.match(
            invoice.description,
            /Orchestrations: InvoiceNotification, SendNotification\./
        );
        assert.match(invoice.description, /Receives: RL_Invoice_File \(FILE\)\./);
        assert.match(invoice.description, /Sends: SP_Notification_SB \(SB-Messaging\)\./);

        const customer = result.groups.find((group) => group.id === 'flow-customersync');
        assert.ok(customer);
        assert.deepEqual(customer.artifactIds, [
            'map-customer',
            'orch-customer',
            'project-cdm',
            'project-orchestrations',
            'schema-customer',
            'schema-invoice',
        ]);
        assert.equal(customer.endpointNames, undefined);
        assert.equal(customer.category, 'business-process');

        const route = result.groups.find((group) => group.id === 'flow-rp-customer');
        assert.ok(route);
        assert.deepEqual(route.artifactIds, ['binding-app']);
        assert.deepEqual(route.endpointNames, [
            'RL_Customer_File',
            'RP_Customer',
            'SP_Customer_Out',
        ]);

        assert.deepEqual(result.sharedArtifactIds, [
            'binding-app',
            'project-cdm',
            'project-orchestrations',
            'schema-invoice',
        ]);
        assert.deepEqual(result.ungroupedArtifactIds, ['schema-unused']);
        assert.deepEqual(result.missingProjects, [
            {
                project: 'Common',
                path: path.join(appRoot, 'Common', 'Common.btproj'),
                referencedBy: ['Orchestrations'],
            },
        ]);
        assert.match(result.explanation, /Ports not linked to a flow [^:]*: RP_Orphan\./);
        assert.match(
            result.explanation,
            /Referenced projects missing from the source folder: Common/
        );
    });

    it('returns identical groups regardless of inventory order', () => {
        const artifacts = sampleApplication();
        const expected = detectFlowGroups(artifacts);
        for (const order of [
            [...artifacts].reverse(),
            [...artifacts.slice(5), ...artifacts.slice(0, 5)],
        ]) {
            assert.deepEqual(detectFlowGroups(order), expected);
        }
    });

    it('keeps the IDs of same-named flows when their clusters change', () => {
        const appA = artifact('c1111111', 'Process', 'orchestration', 'AppA/Process.odx');
        const appB = (calls?: string) =>
            artifact('c2222222', 'Process', 'orchestration', 'AppB/Process.odx', {
                actions: calls
                    ? [
                          {
                              type: 'call-workflow',
                              sourceMapping: {
                                  biztalk: {
                                      shapeType: 'CallOrchestration',
                                      calledOrchestration: calls,
                                  },
                              },
                          },
                      ]
                    : [],
            });
        const idOf = (groups: { id: string; artifactIds: string[] }[], artifactId: string) =>
            groups.find((group) => group.artifactIds.includes(artifactId))?.id;

        const before = detectFlowGroups([appA, appB()]).groups;
        const after = detectFlowGroups([
            appA,
            appB('Helper'),
            artifact('c0000000', 'Helper', 'orchestration', 'AppB/Helper.odx'),
        ]).groups;

        assert.notEqual(idOf(before, 'c1111111'), idOf(before, 'c2222222'));
        assert.match(idOf(before, 'c1111111') ?? '', /^flow-process-[0-9a-f]{6}$/);
        assert.equal(idOf(after, 'c1111111'), idOf(before, 'c1111111'));
        assert.equal(idOf(after, 'c2222222'), idOf(before, 'c2222222'));
    });

    it('links maps only to schemas with the exact referenced name', () => {
        const artifacts = [
            artifact('s-order', 'Order', 'schema', 'Schemas/Order.xsd', {
                schemas: [{ id: 's1', name: 'Order', targetNamespace: 'urn:order' }],
            }),
            artifact('s-po', 'PurchaseOrder', 'schema', 'Schemas/PurchaseOrder.xsd', {
                schemas: [{ id: 's2', name: 'PurchaseOrder', targetNamespace: 'urn:po' }],
            }),
            artifact('m-po', 'PurchaseOrderToInvoice', 'map', 'Maps/PO.btm', {
                maps: [
                    {
                        id: 'm',
                        name: 'PurchaseOrderToInvoice',
                        sourceSchema: 'Company.Schemas.PurchaseOrder',
                    },
                ],
            }),
        ];
        const edges = LLMFlowGenerator.getInstance()
            .buildArtifactConnectionGraph(artifacts)
            .connections.filter((c) => c.type === 'map-source-schema')
            .map((c) => `${c.fromId}->${c.toId}`);
        assert.deepEqual(edges, ['s-po->m-po']);
    });

    it('matches project references written with either path separator', () => {
        const references = [
            `${appRoot}/Cdm/Cdm.btproj`,
            [appRoot, 'Common', 'Common.btproj'].join('\\'),
        ];
        const missing = findMissingProjectReferences([
            artifact(
                'project-orch',
                'Orchestrations',
                'custom-code',
                'Orch/Orchestrations.btproj',
                {
                    extensions: { biztalk: { projectReferences: references } },
                }
            ),
            artifact('project-cdm', 'Cdm', 'custom-code', 'Cdm/Cdm.btproj'),
        ]);
        assert.deepEqual(
            missing.map((m) => m.project),
            ['Common']
        );
    });

    it('does not merge orchestrations whose names only overlap', () => {
        const result = detectFlowGroups([
            artifact('orch-order', 'Order', 'orchestration', 'Orch/Order.odx', {
                actions: [
                    {
                        type: 'call-workflow',
                        sourceMapping: {
                            biztalk: {
                                shapeType: 'StartOrchestration',
                                startedOrchestration: 'OrderStatus',
                            },
                        },
                    },
                ],
            }),
            artifact('orch-order-status', 'OrderStatus', 'orchestration', 'Orch/OrderStatus.odx'),
            artifact('orch-order-audit', 'OrderAudit', 'orchestration', 'Orch/OrderAudit.odx'),
        ]);
        assert.deepEqual(
            result.groups.map((group) => group.artifactIds),
            [['orch-order', 'orch-order-status'], ['orch-order-audit']]
        );
    });
});

describe('Deterministic flow grouping of the BizTalk sample', () => {
    let workspace: string;

    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('links the orchestration to its map, message schemas and projects', async () => {
        await discoverSample();
        const artifacts = await InventoryService.getInstance().getAllParsedArtifacts();
        const result = detectFlowGroups(artifacts);
        const nameOf = (id: string) => artifacts.find((a) => a.id === id)?.name;

        assert.equal(result.groups.length, 1);
        assert.equal(result.groups[0].id, 'flow-helloschedule');
        assert.equal(result.groups[0].name, 'Hello Schedule');
        assert.deepEqual(result.groups[0].artifactIds.map(nameOf).sort(), [
            'HelloSchedule',
            'InvoiceSchema',
            'Maps',
            'Orchestrations',
            'POSchema',
            'POToInvoice',
            'Schemas',
        ]);
        assert.deepEqual(result.ungroupedArtifactIds.map(nameOf), ['HelloApplicationDeployment']);
        assert.deepEqual(result.sharedArtifactIds, []);
        assert.deepEqual(result.missingProjects, []);
        assert.deepEqual(findMissingProjectReferences(artifacts), []);
    });

    it('reports referenced projects that were not scanned', async () => {
        await discoverSample();
        const artifacts = (await InventoryService.getInstance().getAllParsedArtifacts()).filter(
            (a) => a.name !== 'Schemas' && a.name !== 'POSchema' && a.name !== 'InvoiceSchema'
        );
        assert.deepEqual(
            findMissingProjectReferences(artifacts).map((missing) => [
                missing.project,
                missing.referencedBy,
            ]),
            [['Schemas', ['Maps', 'Orchestrations']]]
        );
    });
});

describe('Flow group validation and scoping helpers', () => {
    const groups = [
        { id: 'a', name: 'A', artifactIds: ['orch-a', 'schema-cdm', 'binding'] },
        { id: 'b', name: 'B', artifactIds: ['orch-b', 'schema-cdm', 'binding', 'map-b'] },
    ];
    const connections = [
        {
            fromId: 'schema-cdm',
            toId: 'map-b',
            type: 'map-source-schema' as const,
            evidence: 'cdm',
        },
        {
            fromId: 'binding',
            toId: 'orch-a',
            type: 'binding-references' as const,
            evidence: 'bind',
        },
        {
            fromId: 'orch-a',
            toId: 'map-b',
            type: 'orchestration-uses-map' as const,
            evidence: 'uses',
        },
        { fromId: 'orch-a', toId: 'orch-b', type: 'shared-namespace' as const, evidence: 'ns' },
    ];

    it('allows dependencies on shared artifacts but rejects other cross-group links', () => {
        const shared = new Set(['schema-cdm', 'binding']);
        assert.deepEqual(findUndeclaredSharedArtifacts(groups, shared), []);
        assert.deepEqual(
            findCrossGroupDependencies(groups, connections, shared).map((d) => [
                d.fromGroup,
                d.toGroup,
                d.dependencyType,
            ]),
            [['A', 'B', 'orchestration-uses-map']]
        );
        assert.deepEqual(findUndeclaredSharedArtifacts(groups, new Set(['binding'])), [
            { artifactId: 'schema-cdm', groups: ['A', 'B'] },
        ]);
    });

    it('scopes binding endpoints to the ports of one flow', () => {
        const receiveEndpoints = [
            {
                name: 'RL_Invoice_File',
                sourceMapping: { biztalk: { receivePortName: 'RP_Invoice' } },
            },
            {
                name: 'RL_Customer_File',
                sourceMapping: { biztalk: { receivePortName: 'RP_Customer' } },
            },
        ];
        const sendEndpoints = [{ name: 'SP_Notification_SB' }, { name: 'SP_Customer_Out' }];

        const scoped = scopeEndpointsToFlow(receiveEndpoints, sendEndpoints, [
            'RP_Invoice',
            'sp_notification_sb',
        ]);
        assert.deepEqual(
            scoped.receive.map((e) => e.name),
            ['RL_Invoice_File']
        );
        assert.deepEqual(
            scoped.send.map((e) => e.name),
            ['SP_Notification_SB']
        );
        assert.equal(scoped.omitted, 2);
        assert.equal(scopeEndpointsToFlow(receiveEndpoints, sendEndpoints, undefined).omitted, 0);
    });

    it('reads receive-port subscriptions from XML and text filters', () => {
        assert.deepEqual(
            subscribedReceivePorts(
                '<Filter><Group><Statement Property="BTS.ReceivePortName" Operator="0" Value="RP_A" />' +
                    '<Statement Property="BTS.MessageType" Operator="0" Value="x#y" /></Group>' +
                    '<Group><Statement Value="RP_B" Operator="0" Property="BTS.ReceivePortName" /></Group>' +
                    '<Group><Statement Property="BTS.ReceivePortName" Operator="1" Value="RP_C" /></Group></Filter>'
            ),
            ['RP_A', 'RP_B']
        );
        assert.deepEqual(subscribedReceivePorts('BTS.ReceivePortName == "RP_D"'), ['RP_D']);
    });

    it('reports artifacts added or removed since grouping', () => {
        const grouped = {
            groups: [
                {
                    id: 'a',
                    name: 'A',
                    description: '',
                    category: 'other' as const,
                    artifactIds: ['x', 'y'],
                },
            ],
            ungroupedArtifactIds: ['z'],
            sharedArtifactIds: ['y'],
        };
        assert.deepEqual(compareInventoryWithGroups(['x', 'y', 'z'], grouped), {
            added: [],
            removed: [],
        });
        assert.deepEqual(compareInventoryWithGroups(['x', 'z', 'cdm-schema'], grouped), {
            added: ['cdm-schema'],
            removed: ['y'],
        });
    });

    it('names and resolves references deterministically', () => {
        assert.equal(humanizeName('Orch_InvoiceNotification'), 'Invoice Notification');
        assert.equal(humanizeName('Contoso.HR.ProcessXMLInvoice'), 'Process XML Invoice');
        assert.equal(
            simpleName('Contoso.Pipelines.Rcv, Contoso.Pipelines, Version=1.0.0.0'),
            'rcv'
        );
        assert.equal(simpleName('..\\Cdm\\Invoice.xsd'), 'invoice');
        assert.equal(simpleName('Contoso.Schemas.Order+OrderLine'), 'order');
        assert.equal(resolveGroupingMode('auto', 'biztalk'), 'deterministic');
        assert.equal(resolveGroupingMode(undefined, 'mulesoft'), 'copilot');
        assert.equal(resolveGroupingMode('copilot', 'biztalk'), 'copilot');
        assert.equal(resolveGroupingMode('deterministic', 'tibco'), 'deterministic');
    });
});
