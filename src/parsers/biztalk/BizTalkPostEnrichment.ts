/**
 * BizTalk Post-Parse Enrichment
 *
 * After all artifacts are parsed, copies connection and endpoint data from
 * binding artifacts to matching orchestration artifacts.
 *
 * BizTalk bindings carry the physical port → adapter information, while
 * orchestration .odx files only declare logical ports. The binding's
 * `extensions.biztalk.orchestrationBindings` provides the join key between
 * orchestration names and physical port names, letting us filter the
 * relevant connections/endpoints for each orchestration.
 *
 * @module parsers/biztalk/BizTalkPostEnrichment
 */

import { IRConnection, IRDocument } from '../../ir/types';
import { ParsedArtifact } from '../../stages/discovery/types';
import { LoggingService } from '../../services/LoggingService';

// =============================================================================
// Types
// =============================================================================

/** Shape of orchestration binding entries from binding IR extensions */
interface OrchestrationBindingEntry {
    orchestrationName: string;
    portBindings: {
        portName: string;
        boundTo: string;
        isSendPortGroup: boolean;
        bindingOption: number;
    }[];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Enrich orchestration artifacts with connection and endpoint data from
 * binding artifacts.
 *
 * This mutates the `parsedArtifacts` array in place (replacing entries with
 * updated copies whose `ir.connections` / `ir.endpoints` are populated).
 */
export function enrichConnectionsFromBindings(
    parsedArtifacts: ParsedArtifact[],
    logger: LoggingService
): void {
    const bindingArtifacts = parsedArtifacts.filter((a) => a.type === 'binding');
    const orchestrationArtifacts = parsedArtifacts.filter((a) => a.type === 'orchestration');

    if (bindingArtifacts.length === 0 || orchestrationArtifacts.length === 0) {
        return;
    }

    for (const binding of bindingArtifacts) {
        const bindingIR = binding.ir;
        const bindingConnections = [...(bindingIR.connections ?? [])];
        const orchestrationBindings: OrchestrationBindingEntry[] =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bindingIR as any).extensions?.biztalk?.orchestrationBindings ?? [];

        if (
            bindingConnections.length === 0 &&
            !bindingIR.endpoints?.receive?.length &&
            !bindingIR.endpoints?.send?.length
        ) {
            continue;
        }

        // Build port name → adapter type lookup from binding endpoints
        const portToAdapterType = new Map<string, string>();
        for (const ep of bindingIR.endpoints?.receive ?? []) {
            const portName = (ep.sourceMapping?.biztalk as Record<string, unknown> | undefined)
                ?.receivePortName as string | undefined;
            const adapterType = (ep.sourceMapping?.biztalk as Record<string, unknown> | undefined)
                ?.adapterType as string | undefined;
            if (portName && adapterType) {
                portToAdapterType.set(portName, adapterType.toLowerCase());
            }
        }
        for (const ep of bindingIR.endpoints?.send ?? []) {
            const portName = (ep.sourceMapping?.biztalk as Record<string, unknown> | undefined)
                ?.sendPortName as string | undefined;
            const adapterType = (ep.sourceMapping?.biztalk as Record<string, unknown> | undefined)
                ?.adapterType as string | undefined;
            if (portName && adapterType) {
                portToAdapterType.set(portName, adapterType.toLowerCase());
            }
        }

        for (const orchArtifact of orchestrationArtifacts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const orchExt = (orchArtifact.ir as any).extensions?.biztalk;
            if (!orchExt) {
                continue;
            }

            const orchFullName = orchExt.namespace
                ? `${orchExt.namespace}.${orchExt.orchestrationName}`
                : orchExt.orchestrationName;

            // Find matching binding entry (may be full or partial match)
            const matchingBinding = orchestrationBindings.find(
                (ob) =>
                    ob.orchestrationName === orchFullName ||
                    ob.orchestrationName === orchExt.orchestrationName ||
                    ob.orchestrationName.endsWith(`.${orchExt.orchestrationName}`)
            );

            let connectionsToAssign: IRConnection[];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let receiveEndpoints: any[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let sendEndpoints: any[] = [];

            if (matchingBinding && matchingBinding.portBindings.length > 0) {
                // Determine which adapter types this orchestration uses
                const usedAdapterTypes = new Set<string>();
                const boundPhysicalPorts = new Set<string>();

                for (const pb of matchingBinding.portBindings) {
                    boundPhysicalPorts.add(pb.boundTo);
                    const adapterType = portToAdapterType.get(pb.boundTo);
                    if (adapterType) {
                        usedAdapterTypes.add(adapterType);
                    }
                }

                // Filter connections to only those adapter types used by this orchestration
                connectionsToAssign =
                    usedAdapterTypes.size > 0
                        ? bindingConnections.filter((c) => {
                              const cAdapterType = (
                                  (c.sourceMapping?.biztalk as Record<string, unknown> | undefined)
                                      ?.adapterType as string | undefined
                              )?.toLowerCase();
                              return cAdapterType && usedAdapterTypes.has(cAdapterType);
                          })
                        : bindingConnections; // Fallback: assign all if we can't resolve adapter types

                // Filter endpoints to only those bound to this orchestration's ports
                receiveEndpoints = (bindingIR.endpoints?.receive ?? []).filter((ep) => {
                    const portName = (
                        ep.sourceMapping?.biztalk as Record<string, unknown> | undefined
                    )?.receivePortName as string | undefined;
                    return portName && boundPhysicalPorts.has(portName);
                });
                sendEndpoints = (bindingIR.endpoints?.send ?? []).filter((ep) => {
                    const portName = (
                        ep.sourceMapping?.biztalk as Record<string, unknown> | undefined
                    )?.sendPortName as string | undefined;
                    return portName && boundPhysicalPorts.has(portName);
                });
            } else {
                // No specific binding found for this orchestration — assign all
                connectionsToAssign = bindingConnections;
                receiveEndpoints = [...(bindingIR.endpoints?.receive ?? [])];
                sendEndpoints = [...(bindingIR.endpoints?.send ?? [])];
            }

            if (
                connectionsToAssign.length === 0 &&
                receiveEndpoints.length === 0 &&
                sendEndpoints.length === 0
            ) {
                continue;
            }

            // Create enriched IR document (readonly fields require a new object)
            const enrichedIR: IRDocument = {
                ...orchArtifact.ir,
                connections: connectionsToAssign,
                endpoints: {
                    ...orchArtifact.ir.endpoints,
                    receive: [...(orchArtifact.ir.endpoints?.receive ?? []), ...receiveEndpoints],
                    send: [...(orchArtifact.ir.endpoints?.send ?? []), ...sendEndpoints],
                },
            };

            // Replace the artifact in the array
            const idx = parsedArtifacts.indexOf(orchArtifact);
            if (idx >= 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (parsedArtifacts as any)[idx] = {
                    ...orchArtifact,
                    ir: enrichedIR,
                };

                logger.info('Enriched orchestration with binding connections', {
                    orchestration: orchExt.orchestrationName,
                    connections: connectionsToAssign.length,
                    receiveEndpoints: receiveEndpoints.length,
                    sendEndpoints: sendEndpoints.length,
                });
            }
        }
    }
}
