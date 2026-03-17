#!/usr/bin/env node
/* eslint-disable */
/**
 * build-reference-workflow-catalog.js
 *
 * Scans `resources/referenceWorkflowsAndConnections/` and produces a
 * `catalog.json` in the same directory.  The catalog contains extracted
 * metadata (trigger types, action types, connector IDs, etc.) so the
 * ReferenceWorkflowRegistry can offer fast keyword search without reading
 * every JSON file at runtime.
 *
 * Usage:  node scripts/build-reference-workflow-catalog.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'resources', 'referenceWorkflowsAndConnections');
const WORKFLOWS_DIR = path.join(ROOT, 'workflows');
const CONNECTIONS_DIR = path.join(ROOT, 'connections');
const SERVICE_PROVIDERS_DIR = path.join(ROOT, 'ServiceProviders');
const OUTPUT = path.join(ROOT, 'catalog.json');

// ── Helpers ───────────────────────────────────────────────────────────

/** Recursively find all workflow JSON files (workflow.json and workflow-*.json) under `dir`. */
function findWorkflowFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findWorkflowFiles(full));
        } else if (entry.name.endsWith('.json')) {
            results.push(full);
        }
    }
    return results;
}

/** Recursively find all .json files under `dir`. */
function findJsonFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findJsonFiles(full));
        } else if (entry.name.endsWith('.json')) {
            results.push(full);
        }
    }
    return results;
}

/** Safe JSON parse — returns undefined on failure. Strips UTF-8 BOM if present. */
function tryParseJson(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        // Strip UTF-8 BOM (EF BB BF)
        if (content.charCodeAt(0) === 0xfeff) {
            content = content.slice(1);
        }
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/** Extract all action types from a workflow definition (recursive into nested branches). */
function extractActionTypes(actions) {
    const types = new Set();
    if (!actions || typeof actions !== 'object') {
        return types;
    }
    for (const [, action] of Object.entries(actions)) {
        if (action.type) {
            types.add(action.type);
        }
        // Recurse into nested branches
        if (action.actions) {
            for (const t of extractActionTypes(action.actions)) {
                types.add(t);
            }
        }
        if (action.else?.actions) {
            for (const t of extractActionTypes(action.else.actions)) {
                types.add(t);
            }
        }
        if (action.cases) {
            for (const c of Object.values(action.cases)) {
                if (c.actions) {
                    for (const t of extractActionTypes(c.actions)) {
                        types.add(t);
                    }
                }
            }
        }
        if (action.default?.actions) {
            for (const t of extractActionTypes(action.default.actions)) {
                types.add(t);
            }
        }
    }
    return types;
}

/** Extract serviceProviderIds from actions and triggers. */
function extractServiceProviderIds(obj) {
    const ids = new Set();
    if (!obj || typeof obj !== 'object') {
        return ids;
    }
    for (const [, item] of Object.entries(obj)) {
        const spConfig = item?.inputs?.serviceProviderConfiguration;
        if (spConfig?.serviceProviderId) {
            ids.add(spConfig.serviceProviderId);
        }
        // Recurse into nested actions
        if (item.actions) {
            for (const id of extractServiceProviderIds(item.actions)) {
                ids.add(id);
            }
        }
        if (item.else?.actions) {
            for (const id of extractServiceProviderIds(item.else.actions)) {
                ids.add(id);
            }
        }
        if (item.cases) {
            for (const c of Object.values(item.cases)) {
                if (c.actions) {
                    for (const id of extractServiceProviderIds(c.actions)) {
                        ids.add(id);
                    }
                }
            }
        }
        if (item.default?.actions) {
            for (const id of extractServiceProviderIds(item.default.actions)) {
                ids.add(id);
            }
        }
    }
    return ids;
}

/** Extract operationIds from serviceProviderConfiguration in actions and triggers. */
function extractOperationIds(obj) {
    const ids = new Set();
    if (!obj || typeof obj !== 'object') {
        return ids;
    }
    for (const [, item] of Object.entries(obj)) {
        const spConfig = item?.inputs?.serviceProviderConfiguration;
        if (spConfig?.operationId) {
            ids.add(spConfig.operationId);
        }
        if (item.actions) {
            for (const id of extractOperationIds(item.actions)) {
                ids.add(id);
            }
        }
        if (item.else?.actions) {
            for (const id of extractOperationIds(item.else.actions)) {
                ids.add(id);
            }
        }
        if (item.cases) {
            for (const c of Object.values(item.cases)) {
                if (c.actions) {
                    for (const id of extractOperationIds(c.actions)) {
                        ids.add(id);
                    }
                }
            }
        }
        if (item.default?.actions) {
            for (const id of extractOperationIds(item.default.actions)) {
                ids.add(id);
            }
        }
    }
    return ids;
}

/** Extract managed API connection references (host.connection.referenceName) from actions. */
function extractApiConnectionRefs(actions) {
    const refs = new Set();
    if (!actions || typeof actions !== 'object') {
        return refs;
    }
    for (const [, action] of Object.entries(actions)) {
        const ref = action?.inputs?.host?.connection?.referenceName;
        if (ref) {
            refs.add(ref);
        }
        if (action.actions) {
            for (const r of extractApiConnectionRefs(action.actions)) {
                refs.add(r);
            }
        }
        if (action.else?.actions) {
            for (const r of extractApiConnectionRefs(action.else.actions)) {
                refs.add(r);
            }
        }
        if (action.cases) {
            for (const c of Object.values(action.cases)) {
                if (c.actions) {
                    for (const r of extractApiConnectionRefs(c.actions)) {
                        refs.add(r);
                    }
                }
            }
        }
        if (action.default?.actions) {
            for (const r of extractApiConnectionRefs(action.default.actions)) {
                refs.add(r);
            }
        }
    }
    return refs;
}

// ── Build Workflow Entries ────────────────────────────────────────────

function buildWorkflowEntries() {
    const entries = [];
    const workflowFiles = findWorkflowFiles(WORKFLOWS_DIR);

    for (const filePath of workflowFiles) {
        const json = tryParseJson(filePath);
        if (!json?.definition) {
            continue;
        }

        const def = json.definition;
        const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath, '.json');
        const parentFolder = path.basename(path.dirname(filePath));
        // For workflow-*.json variants, use parentFolder + variant as folder name
        const folder = fileName === 'workflow' ? parentFolder : parentFolder + '/' + fileName;

        // Trigger types & details
        const triggerTypes = [];
        const triggerServiceProviderIds = new Set();
        const triggerOperationIds = new Set();
        if (def.triggers) {
            for (const [, trigger] of Object.entries(def.triggers)) {
                if (trigger.type) {
                    triggerTypes.push(trigger.type);
                }
                const spConfig = trigger?.inputs?.serviceProviderConfiguration;
                if (spConfig?.serviceProviderId) {
                    triggerServiceProviderIds.add(spConfig.serviceProviderId);
                }
                if (spConfig?.operationId) {
                    triggerOperationIds.add(spConfig.operationId);
                }
            }
        }

        // Action types
        const actionTypes = [...extractActionTypes(def.actions)];

        // Service provider IDs from actions + triggers
        const actionSpIds = extractServiceProviderIds(def.actions);
        const allSpIds = new Set([...triggerServiceProviderIds, ...actionSpIds]);

        // Operation IDs from actions + triggers
        const actionOpIds = extractOperationIds(def.actions);
        const allOpIds = new Set([...triggerOperationIds, ...actionOpIds]);

        // API connection refs
        const apiConnectionRefs = [...extractApiConnectionRefs(def.actions)];

        // Tags derived from folder name and content
        const tags = buildTags(folder, triggerTypes, actionTypes, [...allSpIds]);

        entries.push({
            id: `workflows/${folder}`,
            category: 'workflow',
            folder,
            path: rel,
            kind: json.kind || null,
            triggerTypes: [...new Set(triggerTypes)],
            actionTypes: [...new Set(actionTypes)],
            serviceProviderIds: [...allSpIds],
            operationIds: [...allOpIds],
            apiConnectionRefs,
            hasSplitOn: Object.values(def.triggers || {}).some((t) => !!t.splitOn),
            actionCount: def.actions ? Object.keys(def.actions).length : 0,
            tags,
        });
    }
    return entries;
}

// ── Build Connection Entries ─────────────────────────────────────────

function buildConnectionEntries() {
    const entries = [];
    const connectionFiles = findJsonFiles(CONNECTIONS_DIR);

    for (const filePath of connectionFiles) {
        const json = tryParseJson(filePath);
        if (!json) {
            continue;
        }

        const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const folder = path.basename(path.dirname(filePath));

        const managedApis = [];
        if (json.managedApiConnections) {
            for (const [name, conn] of Object.entries(json.managedApiConnections)) {
                const apiId = conn?.api?.id || '';
                const apiType = apiId.split('/').pop() || name;
                managedApis.push({ name, apiType });
            }
        }

        const serviceProviders = [];
        if (json.serviceProviderConnections) {
            for (const [name, conn] of Object.entries(json.serviceProviderConnections)) {
                const spId = conn?.serviceProvider?.id || '';
                serviceProviders.push({
                    name,
                    serviceProviderId: spId,
                    parameterSetName: conn?.parameterSetName || null,
                });
            }
        }

        const hasAgentConnections =
            !!json.agentConnections && Object.keys(json.agentConnections).length > 0;

        const tags = buildConnectionTags(
            folder,
            managedApis,
            serviceProviders,
            hasAgentConnections
        );

        entries.push({
            id: `connections/${folder}`,
            category: 'connection',
            folder,
            path: rel,
            managedApis,
            serviceProviders,
            hasAgentConnections,
            tags,
        });
    }
    return entries;
}

// ── Build ServiceProvider Entries ─────────────────────────────────────

function buildServiceProviderEntries() {
    const entries = [];
    if (!fs.existsSync(SERVICE_PROVIDERS_DIR)) {
        return entries;
    }

    // Each subfolder under ServiceProviders/ may have multiple levels
    // e.g. ServiceProviders/v4/ServiceBusTrigger/workflow.Queue.json
    const allJsonFiles = findJsonFiles(SERVICE_PROVIDERS_DIR);

    // Group by immediate parent directory
    const byParent = new Map();
    for (const filePath of allJsonFiles) {
        const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const parentDir = path.dirname(rel);
        if (!byParent.has(parentDir)) {
            byParent.set(parentDir, []);
        }
        byParent.get(parentDir).push({ filePath, rel });
    }

    for (const [parentDir, files] of byParent) {
        // Determine the base service from directory structure
        const dirParts = parentDir.replace('ServiceProviders/', '').split('/');
        const providerGroup = dirParts[0]; // e.g. "v4", "MI.V4"
        const providerName = dirParts.slice(1).join('/'); // e.g. "ServiceBusTrigger"

        // Extract metadata from all workflow files in this directory
        const allTriggerTypes = new Set();
        const allActionTypes = new Set();
        const allSpIds = new Set();
        const allOpIds = new Set();
        const fileNames = [];

        for (const { filePath, rel } of files) {
            const json = tryParseJson(filePath);
            fileNames.push(path.basename(rel));
            if (!json?.definition) {
                continue;
            }
            const def = json.definition;

            if (def.triggers) {
                for (const [, trigger] of Object.entries(def.triggers)) {
                    if (trigger.type) {
                        allTriggerTypes.add(trigger.type);
                    }
                    const spConfig = trigger?.inputs?.serviceProviderConfiguration;
                    if (spConfig?.serviceProviderId) {
                        allSpIds.add(spConfig.serviceProviderId);
                    }
                    if (spConfig?.operationId) {
                        allOpIds.add(spConfig.operationId);
                    }
                }
            }
            if (def.actions) {
                for (const t of extractActionTypes(def.actions)) {
                    allActionTypes.add(t);
                }
                for (const id of extractServiceProviderIds(def.actions)) {
                    allSpIds.add(id);
                }
                for (const id of extractOperationIds(def.actions)) {
                    allOpIds.add(id);
                }
            }
        }

        const tags = [`service-provider`, providerGroup.toLowerCase()];
        if (providerName) {
            tags.push(
                ...providerName
                    .toLowerCase()
                    .split(/[^a-z0-9]+/)
                    .filter((t) => t.length >= 2)
            );
        }
        for (const spId of allSpIds) {
            const spName = spId.split('/').pop();
            if (spName) {
                tags.push(spName.toLowerCase());
            }
        }

        entries.push({
            id: `ServiceProviders/${dirParts.join('/')}`,
            category: 'service-provider',
            folder: providerName || providerGroup,
            parentGroup: providerGroup,
            path: parentDir,
            fileCount: files.length,
            fileNames,
            triggerTypes: [...allTriggerTypes],
            actionTypes: [...allActionTypes],
            serviceProviderIds: [...allSpIds],
            operationIds: [...allOpIds],
            tags: [...new Set(tags)],
        });
    }
    return entries;
}

// ── Tag Generation ───────────────────────────────────────────────────

function buildTags(folder, triggerTypes, actionTypes, serviceProviderIds) {
    const tags = new Set();

    // From folder name — split on camelCase boundaries, hyphens, underscores
    const folderTokens = folder
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_.()[\]{}]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
    for (const t of folderTokens) {
        tags.add(t);
    }

    // From trigger types
    for (const t of triggerTypes) {
        tags.add(t.toLowerCase());
    }

    // From action types (lowercase)
    for (const t of actionTypes) {
        tags.add(t.toLowerCase());
    }

    // From service provider IDs
    for (const spId of serviceProviderIds) {
        const spName = spId.split('/').pop();
        if (spName) {
            tags.add(spName.toLowerCase());
        }
    }

    // Pattern-based tags
    if (actionTypes.includes('Foreach') || actionTypes.includes('Until')) {
        tags.add('loop');
    }
    if (actionTypes.includes('If') || actionTypes.includes('Switch')) {
        tags.add('branching');
    }
    if (actionTypes.includes('InitializeVariable') || actionTypes.includes('SetVariable')) {
        tags.add('variables');
    }
    if (actionTypes.some((t) => t.toLowerCase().includes('xml'))) {
        tags.add('xml');
        tags.add('transform');
    }
    if (actionTypes.some((t) => t.toLowerCase().includes('json') || t === 'ParseJson')) {
        tags.add('json');
    }
    if (actionTypes.some((t) => t.toLowerCase().includes('swift'))) {
        tags.add('swift');
        tags.add('financial');
    }
    if (actionTypes.includes('Agent')) {
        tags.add('ai');
        tags.add('agent');
    }
    if (actionTypes.includes('CSharpScript')) {
        tags.add('script');
        tags.add('csharp');
    }
    if (triggerTypes.includes('Recurrence')) {
        tags.add('timer');
        tags.add('scheduled');
    }

    return [...tags];
}

function buildConnectionTags(folder, managedApis, serviceProviders, hasAgentConnections) {
    const tags = new Set();

    // From folder name
    const folderTokens = folder
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_.]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
    for (const t of folderTokens) {
        tags.add(t);
    }

    // From managed API types
    for (const api of managedApis) {
        tags.add(api.apiType.toLowerCase());
        tags.add('managed-api');
    }

    // From service provider IDs
    for (const sp of serviceProviders) {
        const spName = sp.serviceProviderId.split('/').pop();
        if (spName) {
            tags.add(spName.toLowerCase());
        }
        tags.add('service-provider');
    }

    if (hasAgentConnections) {
        tags.add('agent');
        tags.add('ai');
    }

    return [...tags];
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
    console.log('Building reference workflow catalog...');
    console.log(`Root: ${ROOT}`);

    const workflows = buildWorkflowEntries();
    console.log(`  Workflows: ${workflows.length} entries`);

    const connections = buildConnectionEntries();
    console.log(`  Connections: ${connections.length} entries`);

    const serviceProviders = buildServiceProviderEntries();
    console.log(`  ServiceProviders: ${serviceProviders.length} entries`);

    const catalog = {
        version: 1,
        generatedAt: new Date().toISOString(),
        totalEntries: workflows.length + connections.length + serviceProviders.length,
        entries: [...workflows, ...connections, ...serviceProviders],
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`\nCatalog written to ${OUTPUT}`);
    console.log(`  Total entries: ${catalog.totalEntries}`);
    console.log(`  File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
}

main();
