const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const skill = fs.readFileSync(
    path.join(repositoryRoot, 'resources', 'skills', 'confluence-publishing', 'SKILL.md'),
    'utf8'
);
const serviceSource = fs.readFileSync(
    path.join(repositoryRoot, 'src', 'services', 'ConfluenceExportService.ts'),
    'utf8'
);

test('publisher skill is pinned to the official Atlassian MCP server', () => {
    assert.match(skill, /https:\/\/mcp\.atlassian\.com\/v2\/mcp/);
    assert.match(skill, /runtime MCP resource\/tool catalogue and schemas/i);
    assert.match(skill, /Never guess a tool name, parameter name/i);
});

test('publisher contract requires a single confirmation before writes', () => {
    assert.match(skill, /one explicit confirmation/i);
    assert.match(skill, /page body and attachments will be updated together/i);
    assert.match(skill, /Do not roll back by deleting anything/i);
});

test('mocked MCP transaction writes the page before every ready attachment', () => {
    const calls = [];
    const mockMcp = {
        createOrUpdatePage() {
            calls.push('page');
            return { id: 'page-1' };
        },
        uploadAttachment(relativePath) {
            calls.push(`attachment:${relativePath}`);
        },
    };

    const readyAttachments = [
        'attachments/architecture.png',
        'attachments/sequence-01-receive.png',
    ];
    const page = mockMcp.createOrUpdatePage();
    for (const attachment of readyAttachments) {
        mockMcp.uploadAttachment(attachment);
    }

    assert.deepEqual(calls, [
        'page',
        'attachment:attachments/architecture.png',
        'attachment:attachments/sequence-01-receive.png',
    ]);
    assert.equal(page.id, 'page-1');
    assert.match(skill, /all ready attachments/i);
});

test('bundle service keeps failed bundles and removes only published bundles', () => {
    assert.match(serviceSource, /status !== 'published' \|\| !receipt\.page/);
    assert.match(serviceSource, /rm\(bundle\.bundlePath, \{ recursive: true, force: true \}\)/);
    assert.match(serviceSource, /writeReceipt/);
});

test('receipt contract rejects local absolute paths and requires publication details', () => {
    assert.match(serviceSource, /successful receipt must contain a valid page URL/i);
    assert.match(serviceSource, /Receipt contains a local absolute path/i);
    assert.match(skill, /must contain no absolute local paths or credentials/i);
});
