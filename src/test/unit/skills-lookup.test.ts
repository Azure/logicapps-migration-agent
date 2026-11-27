import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
    composeSkill,
    isEditedManagedSkill,
    sameSkillContent,
    withContentHash,
} from '../../services/SkillOverlay';
import { mappingSearchTerms, searchMappingSkill } from '../../services/MappingSkillLookup';
import { isSimpleFlow } from '../../stages/discovery/FlowGroupInventory';
import { ChatPrompts } from '../../constants/ChatPrompts';

const base =
    '---\nname: workflow-json-generation-rules\n---\n<!-- skills v1 -->\n# Skill\n\n- Rule A\n';

describe('Customer skill overrides', () => {
    it('appends CUSTOM.md rules as an authoritative section', () => {
        const composed = composeSkill(
            base,
            '\n- Always publish to topic `contoso-out`.\n',
            'workflow-json-generation-rules'
        );
        assert.ok(composed.startsWith(base.trimEnd()));
        assert.match(
            composed,
            /## Customer Overrides\n\n> Maintained in `\.github\/skills\/workflow-json-generation-rules\/CUSTOM\.md`\. When these rules conflict with the rules above, these rules win\.\n\n- Always publish to topic `contoso-out`\.\n$/
        );
        assert.equal(composeSkill(base, '   ', 'x'), base);
        assert.equal(composeSkill(base, undefined, 'x'), base);
    });

    it('detects edits to extension-written skills but not to legacy files', () => {
        const managed = withContentHash(base);
        assert.equal(isEditedManagedSkill(managed), false);
        assert.equal(isEditedManagedSkill(managed.replace(/\n/g, '\r\n')), false);
        assert.equal(
            isEditedManagedSkill(managed.replace('- Rule A', '- Rule A (changed by team)')),
            true
        );
        assert.equal(isEditedManagedSkill(base), false);
        assert.ok(sameSkillContent(managed, managed.replace(/\n/g, '\r\n')));
        assert.ok(!sameSkillContent(managed, base));
    });
});

describe('Mapping skill lookup', () => {
    const skill = [
        '---',
        'name: source-to-logic-apps-mapping',
        'description: FILE and SQL mappings',
        '---',
        '# BizTalk to Logic Apps',
        '## Adapter Mappings',
        '',
        '| BizTalk Component | Logic Apps Equivalent | Native? |',
        '| ---------------- | --------------------- | ------- |',
        '| FILE adapter (receive) | File System trigger | Yes |',
        '| WCF-SQL adapter | SQL Server built-in connector | Yes |',
        '| SB-Messaging | Service Bus built-in connector | Yes |',
        '',
        '## Pipeline Components',
        '',
        '| Component | Equivalent |',
        '|---|---|',
        '| XML Disassembler | XmlParse with schema |',
        '',
        '- Use the File System connector only on Standard; FILE paths must be mounted.',
    ].join('\n');

    it('splits comma-separated phrases or plain words into terms', () => {
        assert.deepEqual(mappingSearchTerms('FILE adapter, WCF-SQL'), ['file adapter', 'wcf-sql']);
        assert.deepEqual(mappingSearchTerms('SB-Messaging send'), ['sb-messaging', 'send']);
        assert.deepEqual(mappingSearchTerms(' , x '), []);
    });

    it('returns matching rows with their section and columns, table rows first', () => {
        const matches = searchMappingSkill(skill, 'file, xml disassembler');
        assert.deepEqual(matches, [
            {
                section: 'Adapter Mappings',
                columns: '| BizTalk Component | Logic Apps Equivalent | Native? |',
                text: '| FILE adapter (receive) | File System trigger | Yes |',
            },
            {
                section: 'Pipeline Components',
                columns: '| Component | Equivalent |',
                text: '| XML Disassembler | XmlParse with schema |',
            },
            {
                section: 'Pipeline Components',
                text: '- Use the File System connector only on Standard; FILE paths must be mounted.',
            },
        ]);
        assert.deepEqual(searchMappingSkill(skill, 'description'), []);
        assert.equal(searchMappingSkill(skill, 'connector', 1).length, 1);
    });

    it('finds adapter rows in the bundled BizTalk mapping skill', () => {
        const bundled = fs.readFileSync(
            path.resolve(
                __dirname,
                '../../../resources/skills/source-to-logic-apps-mapping/biztalk/SKILL.md'
            ),
            'utf-8'
        );
        const matches = searchMappingSkill(bundled, 'WCF-SQL, SB-Messaging', 10);
        assert.ok(matches.length > 0);
        assert.ok(matches.every((m) => /wcf-sql|sb-messaging/i.test(m.text)));
        assert.ok(JSON.stringify(matches).length < bundled.length / 5);
    });
});

describe('Fast path for small flows', () => {
    it('applies only to small flows without custom code', () => {
        const orchestration = { name: 'Orch', type: 'orchestration', sourcePath: 'O.odx' };
        const project = { name: 'Orchestrations', type: 'custom-code', sourcePath: 'O/O.btproj' };
        const helper = { name: 'Helper', type: 'custom-code', sourcePath: 'Lib/Helper.cs' };
        assert.equal(isSimpleFlow([orchestration, project]), true);
        assert.equal(isSimpleFlow([orchestration, helper]), false);
        assert.equal(isSimpleFlow([orchestration, undefined]), false);
        assert.equal(isSimpleFlow([]), false);
        assert.equal(isSimpleFlow(Array(7).fill(orchestration)), false);
    });

    it('adds the fast path and mapping lookup guidance to analysis and planning prompts', () => {
        const analysis = ChatPrompts.flowAnalysis({
            flowName: 'A',
            flowId: 'flow-a',
            simpleFlow: true,
        });
        assert.match(analysis, /FAST PATH: this flow is small and has no custom code/);
        assert.match(analysis, /migration_lookupMapping/);
        assert.match(analysis, /customer-standards\/SKILL\.md/);
        assert.ok(
            !ChatPrompts.flowAnalysis({ flowName: 'A', flowId: 'flow-a' }).includes('FAST PATH')
        );
        const plan = ChatPrompts.planForFlow({
            flowName: 'A',
            flowId: 'flow-a',
            artifactList: 'Artifacts: none',
            simpleFlow: true,
        });
        assert.match(plan, /FAST PATH/);
    });
});
