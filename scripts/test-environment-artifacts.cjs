const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { promisify } = require('node:util');
const ts = require('typescript');

// Load the TypeScript services without starting a VS Code extension host.
const modules = new Map();
const warnings = [];
const sqlCalls = [];
let homeOverride;
const workspaceCommands = [];
const vscode = {
    workspace: { workspaceFolders: undefined },
    Uri: { file: (fsPath) => ({ scheme: 'file', fsPath }) },
    commands: {
        async executeCommand(...args) {
            workspaceCommands.push(args);
        },
    },
};
const logger = {
    debug() {},
    info() {},
    error() {},
    warn(...args) {
        warnings.push(args);
    },
};
const execFile = () => {
    throw new Error('Unexpected external command');
};
execFile[promisify.custom] = async (command, args) => {
    assert.equal(command, 'sqlcmd');
    sqlCalls.push(args);
    return { stdout: ' [] \r\n', stderr: '' };
};
function load(relativePath) {
    const filename = path.resolve(__dirname, '..', relativePath);
    if (modules.has(filename)) {
        return modules.get(filename).exports;
    }
    const instance = new Module(filename, module);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    modules.set(filename, instance);
    const nativeRequire = instance.require.bind(instance);
    instance.require = (id) => {
        if (id.endsWith('/LoggingService')) {
            return { LoggingService: { getInstance: () => logger } };
        }
        if (id === 'vscode') {
            return vscode;
        }
        if (id === 'os') {
            return { ...os, homedir: () => homeOverride ?? os.homedir() };
        }
        if (id === 'child_process') {
            return { execFile };
        }
        if (id.startsWith('.')) {
            const target = path.resolve(path.dirname(filename), id);
            for (const candidate of [`${target}.ts`, path.join(target, 'index.ts')]) {
                if (fs.existsSync(candidate)) {
                    return load(candidate);
                }
            }
        }
        return nativeRequire(id);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
        fileName: filename,
    });
    instance._compile(compiled.outputText, filename);
    return instance.exports;
}

async function main() {
    const { defaultParserRegistry } = load('src\\parsers\\ParserRegistry.ts');
    for (const name of ['Schema', 'Pipeline', 'Bindings']) {
        const className = `BizTalk${name}Parser`;
        const Parser = load(`src\\parsers\\biztalk\\${className}.ts`)[className];
        defaultParserRegistry.register(new Parser());
    }
    const { EnvironmentInventoryService } = load(
        'src\\stages\\discovery\\EnvironmentInventoryService.ts'
    );
    const { SourceResolverService } = load('src\\stages\\discovery\\SourceResolverService.ts');
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'biztalk-workspace-test-'));
    try {
        const schema =
            '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:test"><xs:element name="Message" type="xs:string"/></xs:schema>';
        const source = path.join(workspace, 'Source.xsd');
        fs.writeFileSync(source, schema);
        const environment = {
            id: 'test',
            environmentName: 'http://localhost/BizTalkManagementService',
            discoveredAt: new Date().toISOString(),
            authentication: 'windows-integrated',
            applications: [
                {
                    id: 'app',
                    name: '..\\CON:Application',
                    dependencyApplicationIds: [],
                    bindingsXml:
                        '<BindingInfo><ReceivePortCollection/><SendPortCollection/></BindingInfo>',
                    artifacts: [
                        { id: 's1', name: 'Message', type: 'schema', content: schema },
                        { id: 's2', name: 'Message', type: 'schema', content: schema },
                        { id: 'bad', name: '..\\bad', type: 'schema', content: '<not-a-schema/>' },
                        { id: 'missing', name: 'Missing', type: 'map' },
                        { id: 'local', name: 'Source', type: 'schema' },
                        { id: 'port', name: 'Port', type: 'binding' },
                        {
                            id: 'pipeline',
                            name: 'Receive',
                            type: 'pipeline',
                            content: '<Document Type="Receive"><Stages/></Document>',
                        },
                    ],
                },
            ],
        };
        const resolutions = {
            rootPaths: [],
            resolutions: [
                {
                    environmentArtifactId: 'local',
                    status: 'resolved',
                    matchedFiles: [source],
                    candidatePaths: [source],
                },
            ],
        };
        const service = new EnvironmentInventoryService();
        await assert.rejects(service.merge(environment, resolutions, ''), /workspace/);
        await assert.rejects(service.merge(environment, resolutions, source));
        const merged = await service.merge(environment, resolutions, workspace);
        for (const item of merged.inventory.items) {
            assert(path.isAbsolute(item.sourcePath));
            assert(!path.relative(workspace, item.sourcePath).startsWith('..'));
            assert(fs.existsSync(item.sourcePath), item.sourcePath);
            assert.equal(item.metadata.fileSize, fs.statSync(item.sourcePath).size);
        }
        const schemas = merged.inventory.items.filter((item) => item.name === 'Message');
        assert.equal(schemas.length, 2);
        assert.notEqual(schemas[0].sourcePath, schemas[1].sourcePath);
        for (const item of schemas) {
            assert.equal(item.status, 'parsed');
            assert(merged.irDocuments.has(item.irId));
            assert.equal(fs.readFileSync(item.sourcePath, 'utf8'), schema);
        }
        assert.equal(
            merged.inventory.items.find((item) => item.name === '..\\bad').status,
            'error'
        );
        const missing = merged.inventory.items.find((item) => item.name === 'Missing');
        assert.equal(missing.status, 'warning');
        assert.equal(path.basename(missing.sourcePath), 'metadata.json');
        assert.equal(missing.irId, undefined);
        const copied = merged.inventory.items.find((item) => item.name === 'Source');
        assert.notEqual(copied.sourcePath, source);
        assert.equal(fs.readFileSync(copied.sourcePath, 'utf8'), schema);
        const bindings = merged.inventory.items.find((item) => item.name.endsWith('(Bindings)'));
        assert.equal(bindings.status, 'parsed');
        assert.equal(path.basename(bindings.sourcePath), 'BindingInfo.xml');
        const pipeline = merged.inventory.items.find((item) => item.category === 'pipeline');
        assert.equal(pipeline.status, 'parsed');
        assert.equal(path.extname(pipeline.sourcePath), '.btp');
        assert(merged.irDocuments.has(pipeline.irId));
        const { InventoryService } = load('src\\stages\\discovery\\InventoryService.ts');
        const parsedArtifacts = await InventoryService.prototype.getAllParsedArtifacts.call({
            inventory: merged.inventory,
            irCache: merged.irDocuments,
        });
        for (const artifact of parsedArtifacts) {
            assert.equal(artifact.absolutePath, artifact.sourcePath);
            assert(fs.readFileSync(artifact.absolutePath, 'utf8').length > 0);
        }
        assert(warnings.length > 0);
        const repeated = await service.merge(environment, resolutions, workspace);
        assert.deepEqual(
            repeated.inventory.items.map((item) => item.sourcePath),
            merged.inventory.items.map((item) => item.sourcePath)
        );
        const resolvedAgain = await new SourceResolverService().resolve(environment, [workspace]);
        assert.equal(
            resolvedAgain.resolutions.find((item) => item.environmentArtifactId === 'local')
                .matchedFiles.length,
            1
        );
        assert.equal(
            resolvedAgain.resolutions.find((item) => item.environmentArtifactId === 's1').status,
            'unresolved'
        );

        const { BizTalkEnvironmentConnector } = load(
            'src\\stages\\discovery\\BizTalkEnvironmentConnector.ts'
        );
        const connector = new BizTalkEnvironmentConnector();
        await connector.runSqlProjection('server', 'database', 'SELECT 1', 60);
        await connector.runStoredProcedureDiscovery('server', 'database', 60);
        assert.equal(sqlCalls.length, 2);
        for (const args of sqlCalls) {
            assert(!args.includes('-W'));
            assert.equal(args[args.indexOf('-y') + 1], '0');
        }
        const { ensureDiscoveryWorkspace, resumePendingBizTalkDiscovery } = load(
            'src\\stages\\discovery\\DiscoveryWorkspace.ts'
        );
        const state = new Map();
        const context = {
            globalState: {
                get: (key) => state.get(key),
                async update(key, value) {
                    if (value === undefined) {
                        state.delete(key);
                    } else {
                        state.set(key, value);
                    }
                },
            },
        };
        homeOverride = workspace;
        assert.equal(await ensureDiscoveryWorkspace(context), undefined);
        assert.equal(workspaceCommands.length, 1);
        const [command, uri, options] = workspaceCommands[0];
        assert.equal(command, 'vscode.openFolder');
        assert.equal(options.forceReuseWindow, true);
        assert(fs.statSync(uri.fsPath).isDirectory());
        assert.equal(state.size, 1);
        // A different window must not consume this workspace's pending request.
        vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file(workspace) }];
        await resumePendingBizTalkDiscovery(context);
        assert.equal(state.size, 1);
        vscode.workspace.workspaceFolders = [{ uri }];
        assert.equal(await ensureDiscoveryWorkspace(context), vscode.workspace.workspaceFolders[0]);
        await resumePendingBizTalkDiscovery(context);
        assert.equal(state.size, 0);
        assert.equal(workspaceCommands[1][0], 'logicAppsMigrationAgent.discoverBizTalkEnvironment');
        await resumePendingBizTalkDiscovery(context);
        assert.equal(workspaceCommands.length, 2);
        console.log(
            'Passed: workspace creation/resume, persisted artifacts, real schema/pipeline/binding parsing, errors, metadata, copies, repeat discovery, SQL flags.'
        );
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
