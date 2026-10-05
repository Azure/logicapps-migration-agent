import { cancellationToken, mockState } from './vscodeMock';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PlanningDecisionService } from '../../stages/planning/PlanningDecisionService';
import { PlanningFileService } from '../../stages/planning/PlanningFileService';
import {
    FlowPlanningResult,
    PlanningCacheService,
} from '../../stages/planning/PlanningCacheService';
import {
    PlanningBrief,
    PlanningQuestion,
    validatePlanningBrief,
    validatePlanningQuestion,
    validatePlanningPreferences,
} from '../../stages/planning/PlanningDecisions';
import { ChatPrompts } from '../../constants/ChatPrompts';
import { PlanningPreflightTool } from '../../copilot/PlanningPreflightTool';
import { registerMigrationLMTools } from '../../copilot/MigrationLMTools';
import { PlanningWebviewPanel } from '../../views/planning/PlanningWebviewPanel';
import { ReportExporterService } from '../../services/ReportExporterService';
import { LoggingService } from '../../services/LoggingService';
import { LanguageModelTextPart } from 'vscode';
import type { ExtensionContext, LanguageModelToolResult } from 'vscode';
import { Script } from 'vm';

const brokerQuestion: PlanningQuestion = {
    id: 'messaging',
    question: 'Which broker should receive orders?',
    whyItMatters: 'The queue owns delivery guarantees and infrastructure.',
    options: [
        { id: 'service-bus', label: 'Service Bus', description: 'Azure-managed broker.' },
        {
            id: 'rabbitmq',
            label: 'RabbitMQ',
            description: 'Customer-managed broker; validated bridge required.',
        },
    ],
    recommendedOptionId: 'service-bus',
};
const modernizationQuestion: PlanningQuestion = {
    id: 'modernization',
    question: 'Preserve code or prefer equivalent native actions?',
    whyItMatters: 'Refactoring affects effort and parity testing.',
    options: [
        {
            id: 'preserve-code',
            label: 'Preserve code',
            description: 'Retain code in supported local functions.',
        },
        {
            id: 'native-first',
            label: 'Native first',
            description: 'Replace only verified equivalents.',
        },
    ],
};
const brief: PlanningBrief = {
    scenarioName: 'Hybrid with RabbitMQ',
    estimatedTimeline: 'Not estimated',
    assumptions: ['Customer provides broker and hybrid infrastructure.'],
    tradeoffs: ['Local ownership adds operational effort.'],
    opportunities: [
        {
            component: 'ParseOrder',
            currentApproach: 'Custom XML parsing',
            proposedApproach: 'Parse XML with Schema',
            disposition: 'applied',
            reason: 'Equivalent schema and error behavior verified.',
            evidence: 'OrderParser.Parse and Order.xsd; supported XML operation reference.',
        },
    ],
};

function samplePlan(flowId = 'orders'): FlowPlanningResult {
    return {
        flowId,
        flowName: 'Orders',
        generatedAt: '2026-01-01T00:00:00.000Z',
        mermaid: 'flowchart TB\nA-->B',
        explanation: 'Process orders',
        workflows: [],
        azureComponents: [],
        connectorMappings: [],
        actionMappings: [],
        gaps: [],
        patterns: [],
        summary: 'Order migration',
        brief,
    };
}

function toolResult(result: LanguageModelToolResult | undefined | null): Record<string, unknown> {
    assert.ok(result);
    const part = result.content[0];
    assert.ok(part instanceof LanguageModelTextPart);
    return JSON.parse(part.value);
}

describe('Decision-first planning', () => {
    let workspace: string;
    const files = PlanningFileService.getInstance();

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-planning-test-'));
        mockState.workspacePath = workspace;
        mockState.explicitDeployment = undefined;
        mockState.answers = [];
        mockState.prompts = [];
        mockState.notifications = [];
        mockState.planningGroupIds.clear();
        mockState.tools.clear();
        PlanningCacheService.resetInstance();
    });

    afterEach(() => {
        mockState.workspacePath = undefined;
        PlanningCacheService.resetInstance();
        fs.rmSync(workspace, { recursive: true });
    });

    it('asks only hosting and two supplied critical choices, then reuses all answers', async () => {
        mockState.answers = ['hybrid', 'rabbitmq', 'native-first'];
        const service = new PlanningDecisionService();
        const hosting = await service.resolve(
            'orders',
            [brokerQuestion, modernizationQuestion],
            cancellationToken
        );
        assert.strictEqual(hosting.status, 'pending');
        assert.strictEqual(hosting.pendingQuestions?.length, 2);
        assert.strictEqual(mockState.prompts.length, 1);
        const first = await service.resolve(
            'orders',
            [brokerQuestion, modernizationQuestion],
            cancellationToken
        );
        assert.strictEqual(mockState.prompts.length, 3);
        assert.strictEqual(first.status, 'ready');
        assert.deepStrictEqual(
            first.decisions.map((decision) => decision.selectedOptionId),
            ['hybrid', 'rabbitmq', 'native-first']
        );
        const second = await new PlanningDecisionService().resolve(
            'orders',
            [brokerQuestion, modernizationQuestion],
            cancellationToken
        );
        assert.strictEqual(mockState.prompts.length, 3);
        assert.strictEqual(second.revision, first.revision);
        assert.deepStrictEqual(files.readPreferences('orders'), second);
    });

    it('honors explicit hosting configuration without asking, but never treats a default as consent', async () => {
        mockState.explicitDeployment = 'hybrid';
        const configured = await new PlanningDecisionService().resolve(
            'configured',
            [],
            cancellationToken
        );
        assert.strictEqual(mockState.prompts.length, 0);
        assert.strictEqual(configured.decisions[0].source, 'configuration');
        mockState.explicitDeployment = undefined;
        mockState.answers = ['workflow-service-plan'];
        await new PlanningDecisionService().resolve('unconfigured', [], cancellationToken);
        assert.strictEqual(mockState.prompts.length, 1);
    });

    it('records explicit choices from the user request without asking them again', async () => {
        const selected = { ...brokerQuestion, answerFromUser: 'rabbitmq' };
        await new PlanningDecisionService().resolve(
            'orders',
            [],
            cancellationToken,
            false,
            'hybrid'
        );
        const preferences = await new PlanningDecisionService().resolve(
            'orders',
            [selected],
            cancellationToken,
            false,
            'hybrid'
        );
        assert.strictEqual(mockState.prompts.length, 0);
        assert.deepStrictEqual(
            preferences.decisions.map((decision) => decision.source),
            ['user-request', 'user-request']
        );
        assert.throws(
            () => validatePlanningQuestion({ ...brokerQuestion, answerFromUser: 'unknown' }),
            /explicit user answer/
        );
    });

    it('prevents overlapping prompts for the same flow', async () => {
        mockState.answers = ['hybrid'];
        const service = new PlanningDecisionService();
        const first = service.resolve('orders', [], cancellationToken);
        await assert.rejects(service.resolve('orders', [], cancellationToken), /already open/);
        await first;
    });

    it('returns a stopped preflight result on cancellation and releases the discovery progress flag', async () => {
        mockState.planningGroupIds.add('orders');
        const result = await new PlanningPreflightTool().invoke(
            {
                input: { flowId: 'orders', action: 'resolve' },
                toolInvocationToken: undefined,
            },
            cancellationToken
        );
        const part = result.content[0];
        assert.ok(part instanceof LanguageModelTextPart);
        const data = JSON.parse(part.value);
        assert.strictEqual(data.cancelled, true);
        assert.strictEqual(data.ready, false);
        assert.strictEqual(mockState.planningGroupIds.has('orders'), false);
        assert.strictEqual(mockState.notifications.length, 1);
    });

    it('cancels without inventing an answer, preserves answered choices, and resumes at the unanswered choice', async () => {
        mockState.answers = ['hybrid', undefined];
        const service = new PlanningDecisionService();
        await service.resolve('orders', [], cancellationToken);
        await assert.rejects(service.resolve('orders', [brokerQuestion], cancellationToken));
        const paused = files.readPreferences('orders');
        assert.strictEqual(paused?.status, 'pending');
        assert.strictEqual(paused?.decisions.length, 1);
        mockState.answers = ['rabbitmq'];
        const resumed = await service.resolve('orders', [brokerQuestion], cancellationToken);
        assert.strictEqual(resumed.status, 'ready');
        assert.strictEqual(mockState.prompts.length, 3);
    });

    it('invalidates host-dependent choices when the user changes hosting', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['workflow-service-plan', 'service-bus'];
        await service.resolve('orders', [], cancellationToken);
        const old = await service.resolve('orders', [brokerQuestion], cancellationToken);
        mockState.answers = ['hybrid'];
        const updated = await service.resolve('orders', [], cancellationToken, true);
        assert.notStrictEqual(updated.revision, old.revision);
        assert.strictEqual(updated.decisions.length, 1);
        assert.strictEqual(updated.decisions[0].selectedOptionId, 'hybrid');
        assert.strictEqual(updated.status, 'pending');
        assert.strictEqual(updated.pendingQuestions?.[0].id, 'messaging');
    });

    it('reasks a choice if the selected option is no longer available', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['hybrid', 'rabbitmq'];
        await service.resolve('orders', [], cancellationToken);
        await service.resolve('orders', [brokerQuestion], cancellationToken);
        mockState.answers = ['service-bus'];
        const revised = {
            ...brokerQuestion,
            options: [
                brokerQuestion.options[0],
                { id: 'retained', label: 'Retain broker', description: 'Keep an approved bridge.' },
            ],
        };
        const result = await service.resolve('orders', [revised], cancellationToken);
        assert.strictEqual(result.decisions[1].selectedOptionId, 'service-bus');
    });

    it('rejects invalid or excessive questions without writing preferences', async () => {
        const service = new PlanningDecisionService();
        await assert.rejects(
            service.resolve('orders', [brokerQuestion, brokerQuestion], cancellationToken),
            /unique/
        );
        await assert.rejects(
            service.resolve(
                'orders',
                [brokerQuestion, modernizationQuestion, brokerQuestion],
                cancellationToken
            ),
            /at most two/
        );
        assert.throws(
            () => validatePlanningQuestion({ ...brokerQuestion, recommendedOptionId: 'missing' }),
            /recommended/
        );
        assert.strictEqual(files.readPreferences('orders'), undefined);
    });

    it('surfaces corrupt preference files rather than silently using defaults', () => {
        const dir = files.getFlowDir('orders');
        assert.ok(dir);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'planning-preferences.json'), '{invalid');
        assert.throws(() => files.readPreferences('orders'));
        assert.strictEqual(mockState.prompts.length, 0);
    });

    it('validates modernization evidence and dispositions', () => {
        validatePlanningBrief(brief);
        assert.throws(
            () =>
                validatePlanningBrief({
                    ...brief,
                    opportunities: [{ ...brief.opportunities[0], evidence: '' }],
                }),
            /evidence/
        );
        assert.throws(
            () =>
                validatePlanningBrief({
                    ...brief,
                    opportunities: [{ ...brief.opportunities[0], disposition: 'invented' }],
                }),
            /evidence/
        );
    });

    it('requires a workspace instead of returning success without persistence', async () => {
        mockState.workspacePath = undefined;
        await assert.rejects(
            new PlanningDecisionService().resolve('orders', [], cancellationToken),
            /workspace/
        );
        await assert.rejects(PlanningCacheService.getInstance().store(samplePlan()), /workspace/);
        assert.strictEqual(mockState.prompts.length, 0);
    });

    it('registers the preflight tool declared by the extension manifest', () => {
        const context: ExtensionContext = Object.create({ subscriptions: [] });
        const registrations = registerMigrationLMTools(context);
        const manifest = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')
        );
        assert.ok(
            manifest.contributes.languageModelTools.some(
                (tool: { name: string }) => tool.name === 'migration_planning_preflight'
            )
        );
        assert.ok(mockState.tools.has('migration_planning_preflight'));
        registrations.forEach((registration) => registration.dispose());
    });

    it('gates plan metadata on preflight and rejects finalization after choices change', async () => {
        const context: ExtensionContext = Object.create({ subscriptions: [] });
        const registrations = registerMigrationLMTools(context);
        const metadataTool = mockState.tools.get('migration_planning_storeMeta');
        const finalizeTool = mockState.tools.get('migration_planning_finalize');
        assert.ok(metadataTool && finalizeTool);
        const input = {
            flowId: 'orders',
            flowName: 'Orders',
            explanation: 'Orders',
            summary: 'Orders',
            brief,
            startNew: true,
        };
        const missing = toolResult(
            await metadataTool.invoke({ input, toolInvocationToken: undefined }, cancellationToken)
        );
        assert.ok(String(missing.error).includes('preflight'));
        mockState.answers = ['hybrid'];
        const preferences = await new PlanningDecisionService().resolve(
            'orders',
            [],
            cancellationToken
        );
        const stored = toolResult(
            await metadataTool.invoke({ input, toolInvocationToken: undefined }, cancellationToken)
        );
        assert.strictEqual(stored.success, true);
        assert.deepStrictEqual(files.readMeta('orders')?.preferences, preferences);
        files.storeArchitecture('orders', 'flowchart TB\nA-->B');
        files.storeWorkflowDefinition('orders', {
            name: 'orders',
            description: 'Orders',
            triggerType: 'Request',
            actions: [],
            sourceArtifactIds: [],
            definition: {
                $schema:
                    'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
                contentVersion: '1.0.0.0',
                triggers: {},
                actions: {},
            },
        });
        files.storeActionMappings('orders', []);
        files.storeGaps('orders', []);
        files.storePatterns('orders', []);
        files.storeArtifactDispositions('orders', []);
        const cache = PlanningCacheService.getInstance();
        const original = await cache.store(samplePlan());
        await new PlanningDecisionService().resolve(
            'orders',
            [],
            cancellationToken,
            true,
            'workflow-service-plan'
        );
        const rejected = toolResult(
            await finalizeTool.invoke(
                {
                    input: { flowId: 'orders' },
                    toolInvocationToken: undefined,
                },
                cancellationToken
            )
        );
        assert.ok(String(rejected.error).includes('choices are unresolved or changed'));
        assert.strictEqual(cache.get('orders')?.planId, original.planId);
        assert.strictEqual(cache.getHistory('orders').length, 1);
        registrations.forEach((registration) => registration.dispose());
    });

    it('archives each finalization and preserves decisions across a simulated restart', async () => {
        mockState.answers = ['hybrid', 'rabbitmq'];
        await new PlanningDecisionService().resolve('orders', [], cancellationToken);
        const preferences = await new PlanningDecisionService().resolve(
            'orders',
            [brokerQuestion],
            cancellationToken
        );
        const cache = PlanningCacheService.getInstance();
        const first = await cache.store({ ...samplePlan(), preferences });
        const second = await cache.store({ ...first, summary: 'Revised plan' });
        assert.notStrictEqual(first.planId, second.planId);
        assert.strictEqual(cache.getHistory('orders').length, 2);
        assert.strictEqual(
            cache.getVersion('orders', first.planId ?? '')?.summary,
            'Order migration'
        );
        assert.strictEqual(cache.get('orders')?.planId, second.planId);
        PlanningCacheService.resetInstance();
        const restored = PlanningCacheService.getInstance();
        assert.strictEqual(restored.getHistory('orders').length, 2);
        assert.strictEqual(restored.get('orders')?.planId, second.planId);
        assert.deepStrictEqual(restored.get('orders')?.preferences, preferences);
    });

    for (const legacyLocation of ['flat', 'folder']) {
        it(`preserves a legacy ${legacyLocation} plan before overwriting, even when store is the first cache call`, async () => {
            const root = path.join(workspace, '.vscode', 'migration', 'planning');
            const dir = legacyLocation === 'flat' ? root : path.join(root, 'orders');
            fs.mkdirSync(dir, { recursive: true });
            const legacy = { ...samplePlan(), brief: undefined };
            fs.writeFileSync(
                path.join(dir, legacyLocation === 'flat' ? 'plan-orders.json' : 'plan.json'),
                JSON.stringify(legacy)
            );
            const cache = PlanningCacheService.getInstance();
            await cache.store({ ...samplePlan(), summary: 'New plan' });
            PlanningCacheService.resetInstance();
            const history = PlanningCacheService.getInstance().getHistory('orders');
            assert.strictEqual(history.length, 2);
            assert.ok(
                history.some(
                    (version) =>
                        version.planId?.startsWith('legacy-') && version.summary === legacy.summary
                )
            );
        });
    }

    it('clears only drafts on replan, preserving preferences, finalized plan, and history', async () => {
        mockState.answers = ['hybrid'];
        await new PlanningDecisionService().resolve('orders', [], cancellationToken);
        const cache = PlanningCacheService.getInstance();
        const current = await cache.store(samplePlan());
        const dir = files.getFlowDir('orders');
        assert.ok(dir);
        files.storeArchitecture('orders', 'flowchart TB\nA-->B');
        fs.writeFileSync(path.join(dir, 'workflow-old.json'), '{}');
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'Keep user notes');
        files.clearDraft('orders');
        assert.ok(!fs.existsSync(path.join(dir, 'workflow-old.json')));
        assert.ok(!fs.existsSync(path.join(dir, 'architecture.mmd')));
        assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));
        assert.ok(files.readPreferences('orders'));
        assert.strictEqual(cache.getHistory('orders').length, 1);
        assert.strictEqual(cache.get('orders')?.planId, current.planId);
    });

    it('does not update the active in-memory plan when persistence fails', async () => {
        const cache = PlanningCacheService.getInstance();
        const original = await cache.store(samplePlan());
        const dir = files.getFlowDir('orders');
        assert.ok(dir);
        const planPath = path.join(dir, 'plan.json');
        fs.unlinkSync(planPath);
        fs.mkdirSync(planPath);
        await assert.rejects(cache.store({ ...samplePlan(), summary: 'Not committed' }));
        assert.strictEqual(cache.get('orders')?.planId, original.planId);
        assert.strictEqual(cache.getHistory('orders').length, 1);
        assert.ok(!fs.readdirSync(dir).some((name) => name.endsWith('.tmp')));
    });

    it('keeps plan history isolated between flows and clears it on reset', async () => {
        const cache = PlanningCacheService.getInstance();
        const orders = await cache.store(samplePlan());
        await cache.store(samplePlan('invoices'));
        assert.strictEqual(cache.getVersion('invoices', orders.planId ?? ''), undefined);
        await cache.clearAll();
        PlanningCacheService.resetInstance();
        assert.deepStrictEqual(PlanningCacheService.getInstance().getHistory('orders'), []);
    });

    it('only removes the no-questions instruction from planning and requests one selected plan', () => {
        const prompt = ChatPrompts.planForFlow({
            flowId: 'orders',
            flowName: 'Orders',
            artifactList: '',
        });
        assert.ok(prompt.includes('migration_planning_preflight'));
        assert.ok(prompt.includes('ONE selected plan'));
        assert.ok(!prompt.includes('Do NOT pause to ask questions'));
        assert.ok(!prompt.includes('reconsider=true'));
        const review = ChatPrompts.planForFlow({
            flowId: 'orders',
            flowName: 'Orders',
            artifactList: '',
            reconsiderChoices: true,
        });
        assert.ok(review.includes('reconsider=true'));
        assert.ok(ChatPrompts.flowGroupDetection().includes('Do NOT pause to ask questions'));
    });

    it('renders escaped planning details without comparison controls or changing saved plans', async () => {
        const cache = PlanningCacheService.getInstance();
        const first = await cache.store(samplePlan());
        const current = await cache.store({
            ...samplePlan(),
            brief: {
                ...brief,
                scenarioName: '<script>unsafe()</script>',
                tradeoffs: ['<b>not markup</b>'],
            },
        });
        const panel: PlanningWebviewPanel = Object.create(PlanningWebviewPanel.prototype);
        const html = panel['getPlanningSummaryHtml'](current);
        assert.ok(html.includes('&lt;script&gt;unsafe()&lt;/script&gt;'));
        assert.ok(html.includes('&lt;b&gt;not markup&lt;/b&gt;'));
        assert.ok(!html.includes('<script>unsafe()'));
        assert.ok(!html.includes('Compare saved versions'));
        assert.ok(!html.includes('planning-history'));
        assert.ok(!html.includes('data-plan-id'));
        assert.ok(!html.includes('>Current plan<'));
        assert.ok(!html.includes('Change choices and plan'));
        assert.strictEqual(cache.get('orders')?.planId, current.planId);
        assert.strictEqual(cache.getHistory('orders').length, 2);
        assert.deepStrictEqual(cache.getVersion('orders', first.planId ?? ''), first);
        const content = panel['getHtmlContent'](
            [
                {
                    id: 'orders',
                    name: 'Orders',
                    description: '',
                    category: 'orchestration',
                    artifactCount: 0,
                    artifactIds: [],
                    status: 'planned',
                },
            ],
            'orders',
            undefined,
            current
        );
        const scripts = [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
        assert.ok(scripts.length > 0);
        for (const script of scripts) {
            assert.doesNotThrow(() => new Script(script[1]));
        }
        assert.ok(!content.includes('History is read-only'));
        assert.ok(!content.includes('viewPlanVersion'));
    });

    for (const workflowCount of [1, 2]) {
        it(`places decisions and tables in one bottom summary for ${workflowCount} workflow(s)`, async () => {
            const decisions = new PlanningDecisionService();
            await decisions.resolve('orders', [], cancellationToken, false, 'hybrid');
            const preferences = await decisions.resolve(
                'orders',
                [
                    {
                        ...modernizationQuestion,
                        answerFromUser: 'native-first',
                    },
                ],
                cancellationToken
            );
            const plan = await PlanningCacheService.getInstance().store({
                ...samplePlan(),
                preferences,
                workflows: Array.from({ length: workflowCount }, (_, index) => ({
                    name: `orders-${index}`,
                    description: 'Process orders',
                    triggerType: 'Request',
                    actions: [],
                    sourceArtifactIds: [],
                })),
                patterns: [
                    {
                        name: 'Message routing',
                        sourceApproach: 'Route orders',
                        logicAppsApproach: 'Route orders in a workflow',
                        complexity: 'low',
                    },
                ],
            });
            const panel: PlanningWebviewPanel = Object.create(PlanningWebviewPanel.prototype);
            const content = panel['getHtmlContent'](
                [
                    {
                        id: 'orders',
                        name: 'Orders',
                        description: '',
                        category: 'orchestration',
                        artifactCount: 0,
                        artifactIds: [],
                        status: 'planned',
                    },
                ],
                'orders',
                undefined,
                plan
            );
            const summaryIndex = content.indexOf('id="planning-summary"');
            assert.ok(summaryIndex > content.indexOf('Logic Apps Design:'));
            assert.ok(summaryIndex > content.indexOf('Integration Patterns'));
            assert.ok(summaryIndex < content.indexOf('Generated:'));
            assert.strictEqual((content.match(/id="planning-summary"/g) ?? []).length, 1);
            assert.ok(!content.includes('Planning choices and history'));
            assert.ok(!content.includes('>Current plan<'));
            assert.ok(!content.includes('Change choices and plan'));
            assert.ok(!content.includes('reviewPlanningChoices'));
            assert.match(
                content,
                /<button\b(?![^>]*\bdisabled\b)[^>]*>[^<]*Suggest a Change<\/button>/
            );
            assert.match(
                content,
                /<button\b(?![^>]*\bdisabled\b)[^>]*>[^<]*Regenerate Plan<\/button>/
            );
            assert.ok(content.includes('Export Report'));
            assert.ok(!content.includes('Compare saved versions'));
            assert.ok(!content.includes('viewPlanVersion'));
            const summary = panel['getPlanningSummaryHtml'](plan);
            const defaultView = summary.slice(
                0,
                summary.indexOf('<summary>Planning details</summary>')
            );
            assert.ok(defaultView.includes('Hosting: Standard hybrid'));
            assert.ok(defaultView.includes('Modernization: Native first'));
            assert.ok(defaultView.includes('aria-label="Modernization decisions"'));
            assert.ok(defaultView.includes('<th>Target / option</th><th>Decision</th>'));
            assert.ok(!defaultView.includes(modernizationQuestion.question));
            assert.ok(!defaultView.includes(brief.opportunities[0].evidence));
            assert.ok(summary.includes(brief.opportunities[0].evidence));
            assert.ok(!summary.includes('aria-label="Plan history"'));
            assert.ok(!summary.includes('planning-history'));
        });
    }

    it('preserves the legacy summary without empty planning details', async () => {
        const plan = await PlanningCacheService.getInstance().store({
            ...samplePlan(),
            brief: undefined,
        });
        const panel: PlanningWebviewPanel = Object.create(PlanningWebviewPanel.prototype);
        const html = panel['getPlanningSummaryHtml'](plan);
        assert.ok(html.includes(plan.summary));
        assert.ok(!html.includes('<summary>Planning details</summary>'));
        assert.ok(!html.includes('<strong>Decisions:</strong>'));
        assert.ok(!html.includes('Compare saved versions'));
    });

    it('includes decisions, modernization opportunities, and scenario comparison in the selected report', async () => {
        mockState.answers = ['hybrid', 'rabbitmq'];
        await new PlanningDecisionService().resolve('orders', [], cancellationToken);
        const preferences = await new PlanningDecisionService().resolve(
            'orders',
            [brokerQuestion],
            cancellationToken
        );
        const cache = PlanningCacheService.getInstance();
        const first = await cache.store({
            ...samplePlan(),
            preferences,
            summary: 'First version report',
        });
        await cache.store({ ...samplePlan(), summary: 'Current version report' });
        const exporter: ReportExporterService = Object.create(ReportExporterService.prototype);
        const sections = await exporter['buildPlanningSections'](first, undefined, new Map());
        const content = JSON.stringify(sections);
        assert.ok(content.includes('First version report'));
        assert.ok(!content.includes('Current version report'));
        assert.ok(content.includes('RabbitMQ'));
        assert.ok(content.includes('Parse XML with Schema'));
        assert.ok(content.includes('Saved Scenario Comparison'));
    });

    it('renders the current plan without reading comparison history', async () => {
        const cache = PlanningCacheService.getInstance();
        const first = await cache.store({ ...samplePlan(), summary: 'Previous plan summary' });
        const current = await cache.store({ ...samplePlan(), summary: 'Current plan summary' });
        const webview = { html: '' };
        const panel: PlanningWebviewPanel = Object.create(PlanningWebviewPanel.prototype);
        Object.defineProperties(panel, {
            logger: { value: LoggingService.getInstance() },
            panel: { value: { title: 'Planning', webview } },
            planningService: {
                value: {
                    getState: () => ({ selectedFlowId: 'orders' }),
                    getPlan: () => undefined,
                    buildFlowsFromDiscovery: () => [
                        {
                            id: 'orders',
                            name: 'Orders',
                            description: '',
                            category: 'orchestration',
                            artifactCount: 0,
                            artifactIds: [],
                            status: 'planned',
                        },
                    ],
                },
            },
        });
        const dir = files.getFlowDir('orders');
        assert.ok(dir);
        fs.writeFileSync(path.join(dir, 'history', 'corrupt.json'), '{invalid');
        assert.throws(() => cache.getHistory('orders'));
        panel.update();
        assert.ok(webview.html.includes(current.summary));
        assert.ok(!webview.html.includes(first.summary));
        assert.ok(!webview.html.includes('Compare saved versions'));
        assert.deepStrictEqual(mockState.notifications, []);
        assert.strictEqual(cache.get('orders')?.planId, current.planId);
    });

    it('does not clear a canceled invalidated choice during hosting-only resume', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['hybrid', 'rabbitmq'];
        await service.resolve('orders', [], cancellationToken);
        const original = await service.resolve('orders', [brokerQuestion], cancellationToken);
        const replacement: PlanningQuestion = {
            ...brokerQuestion,
            options: [
                brokerQuestion.options[0],
                {
                    id: 'bridge',
                    label: 'Approved bridge',
                    description: 'Keep the broker behind a supported bridge.',
                },
            ],
        };
        await assert.rejects(service.resolve('orders', [replacement], cancellationToken));
        const paused = files.readPreferences('orders');
        assert.ok(paused);
        assert.notStrictEqual(paused.revision, original.revision);
        assert.ok(!paused.decisions.some((decision) => decision.id === 'messaging'));
        assert.deepStrictEqual(
            paused.pendingQuestions?.map((question) => question.id),
            ['messaging']
        );
        const resumed = await new PlanningDecisionService().resolve(
            'orders',
            [],
            cancellationToken
        );
        assert.strictEqual(resumed.status, 'pending');
        assert.strictEqual(resumed.revision, paused.revision);
        assert.throws(
            () => validatePlanningPreferences({ ...resumed, status: 'ready' }),
            /pending/
        );
        mockState.answers = ['bridge'];
        const resolved = await service.resolve('orders', [replacement], cancellationToken);
        assert.strictEqual(resolved.status, 'ready');
        assert.deepStrictEqual(resolved.pendingQuestions, []);
    });

    it('keeps later unanswered questions pending when an earlier prompt is canceled', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['hybrid'];
        await service.resolve('orders', [], cancellationToken);
        await assert.rejects(
            service.resolve('orders', [brokerQuestion, modernizationQuestion], cancellationToken)
        );
        const resumed = await service.resolve('orders', [], cancellationToken);
        assert.strictEqual(resumed.status, 'pending');
        assert.deepStrictEqual(
            resumed.pendingQuestions?.map((question) => question.id),
            ['messaging', 'modernization']
        );
        mockState.answers = ['rabbitmq'];
        const partial = await service.resolve('orders', [brokerQuestion], cancellationToken);
        assert.strictEqual(partial.status, 'pending');
        assert.deepStrictEqual(
            partial.pendingQuestions?.map((question) => question.id),
            ['modernization']
        );
    });

    it('reconsiders only supplied choices without reopening hosting', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['hybrid', 'rabbitmq'];
        await service.resolve('orders', [], cancellationToken);
        await service.resolve('orders', [brokerQuestion], cancellationToken);
        mockState.answers = ['hybrid', 'service-bus'];
        await service.resolve('orders', [], cancellationToken, true);
        const result = await service.resolve('orders', [brokerQuestion], cancellationToken, true);
        assert.strictEqual(result.status, 'ready');
        assert.deepStrictEqual(
            result.decisions.map((decision) => decision.selectedOptionId),
            ['hybrid', 'service-bus']
        );
        assert.strictEqual(mockState.prompts.length, 4);
        assert.ok(mockState.prompts[3].startsWith(brokerQuestion.question));
    });

    it('defers supplied host-specific options when the hosting target changes', async () => {
        const service = new PlanningDecisionService();
        mockState.answers = ['workflow-service-plan', 'service-bus'];
        await service.resolve('orders', [], cancellationToken);
        await service.resolve('orders', [brokerQuestion], cancellationToken);
        const pending = await service.resolve(
            'orders',
            [brokerQuestion],
            cancellationToken,
            true,
            'hybrid'
        );
        assert.strictEqual(pending.status, 'pending');
        assert.strictEqual(mockState.prompts.length, 2);
        assert.strictEqual(pending.decisions.length, 1);
        assert.strictEqual(pending.decisions[0].selectedOptionId, 'hybrid');
        mockState.answers = ['rabbitmq'];
        const checkedForHybrid = {
            ...brokerQuestion,
            whyItMatters: 'The bridge and connectivity were revalidated for hybrid.',
        };
        const resolved = await service.resolve('orders', [checkedForHybrid], cancellationToken);
        assert.strictEqual(resolved.status, 'ready');
        assert.strictEqual(resolved.decisions[1].selectedOptionId, 'rabbitmq');
    });

    it('refreshes configuration-sourced hosting and invalidates host-dependent decisions', async () => {
        const service = new PlanningDecisionService();
        mockState.explicitDeployment = 'workflow-service-plan';
        await service.resolve('orders', [], cancellationToken);
        mockState.answers = ['service-bus'];
        const original = await service.resolve('orders', [brokerQuestion], cancellationToken);
        mockState.explicitDeployment = 'hybrid';
        const updated = await service.resolve('orders', [brokerQuestion], cancellationToken);
        assert.strictEqual(updated.decisions[0].selectedOptionId, 'hybrid');
        assert.strictEqual(updated.decisions[0].source, 'configuration');
        assert.notStrictEqual(updated.revision, original.revision);
        assert.strictEqual(updated.status, 'pending');
        assert.deepStrictEqual(
            updated.pendingQuestions?.map((question) => question.id),
            ['messaging']
        );
        assert.strictEqual(mockState.prompts.length, 1);
    });

    it('preserves explicit per-flow hosting overrides when configuration changes', async () => {
        const service = new PlanningDecisionService();
        const original = await service.resolve('orders', [], cancellationToken, false, 'hybrid');
        mockState.explicitDeployment = 'workflow-service-plan';
        const reused = await service.resolve('orders', [], cancellationToken);
        assert.strictEqual(reused.status, 'ready');
        assert.strictEqual(reused.decisions[0].selectedOptionId, 'hybrid');
        assert.strictEqual(reused.revision, original.revision);
        assert.strictEqual(mockState.prompts.length, 0);
    });
});
