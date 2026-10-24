import * as assert from 'assert/strict';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const workflow = fs
    .readFileSync(
        path.resolve(__dirname, '../../../.github/workflows/version-release.yml'),
        'utf8'
    )
    .replace(/\r\n/g, '\n');
const bash =
    process.platform === 'win32'
        ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git/bin/bash.exe')
        : 'bash';

function stepScript(name: string): string {
    const step = workflow.split(`- name: '${name}'`)[1]?.split(/\n {12}- name:/)[0];
    assert.ok(step, `Missing workflow step: ${name}`);
    const script = step.split('run: |\n')[1];
    assert.ok(script, `Missing run script: ${name}`);
    return script.replace(/^ {18}/gm, '');
}

describe('Release workflow', () => {
    let workspace: string;

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'release-workflow-'));
        fs.writeFileSync(path.join(workspace, 'package.json'), '{"version":"1.16.0"}\n');
        fs.writeFileSync(
            path.join(workspace, 'package-lock.json'),
            '{"version":"1.16.0","lockfileVersion":3,"packages":{"":{"version":"1.16.0"}}}\n'
        );
        git('init', '--quiet');
        git('config', 'user.name', 'Release test');
        git('config', 'user.email', 'release-test@example.invalid');
        git('add', '.');
        git('commit', '-m', 'Initial version');
    });

    afterEach(() => fs.rmSync(workspace, { recursive: true, force: true }));

    function git(...args: string[]): string {
        return execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
    }

    function runStep(name: string, releaseType: string, version = ''): string {
        const script = stepScript(name)
            .replace(/\$\{\{ github\.event\.inputs\.release_type \}\}/g, releaseType)
            .replace(/\$\{\{ steps\.version\.outputs\.new_version \}\}/g, version);
        const output = path.join(workspace, 'output');
        execFileSync(bash, ['-e', '-c', script], {
            cwd: workspace,
            env: { ...process.env, GITHUB_OUTPUT: output.replace(/\\/g, '/') },
        });
        return fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
    }

    it('bumps the package version when no release tags exist', () => {
        const output = runStep('Calculate Next Version', 'minor');
        assert.match(output, /new_version=1\.17\.0\n/);
        assert.match(output, /previous_tag=\n/);
    });

    it('uses the latest stable release tag for successive minor and major releases', () => {
        for (const tag of ['v1.17.0', 'v1.19.0', 'v1.20.0', 'v9.0.0-preview', 'other']) {
            git('tag', tag);
        }
        assert.match(runStep('Calculate Next Version', 'minor'), /new_version=1\.21\.0\n/);
        assert.match(runStep('Calculate Next Version', 'major'), /new_version=2\.0\.0\n/);
    });

    it('keeps hotfix patches on their existing major and minor release line', () => {
        for (const tag of ['v1.16.2', 'v1.16.10', 'v1.17.0', 'v2.0.0']) {
            git('tag', tag);
        }
        assert.match(runStep('Calculate Next Version', 'patch'), /new_version=1\.16\.11\n/);
    });

    it('finds the previous release even when its commit is not on the source branch', () => {
        const source = git('rev-parse', 'HEAD');
        git('commit', '--allow-empty', '-m', 'Previous tag-only release');
        git('tag', 'v1.17.0');
        git('checkout', '--quiet', '--detach', source);
        const output = runStep('Calculate Next Version', 'minor');
        assert.match(output, /new_version=1\.18\.0\n/);
        assert.match(output, /previous_tag=v1\.17\.0\n/);
        assert.ok(
            stepScript('Generate Release Notes').includes(
                'PREV_TAG="${{ steps.version.outputs.previous_tag }}"'
            )
        );
    });

    it('never downgrades a package version newer than its tags', () => {
        git('tag', 'v1.15.0');
        assert.match(runStep('Calculate Next Version', 'minor'), /new_version=1\.17\.0\n/);
    });

    it('commits both version files for the release tag without pushing a branch', () => {
        runStep('Update package.json version', 'minor', '1.17.0');
        runStep('Commit Version Bump for Release Tag', 'minor', '1.17.0');
        assert.equal(JSON.parse(git('show', 'HEAD:package.json')).version, '1.17.0');
        const lock = JSON.parse(git('show', 'HEAD:package-lock.json'));
        assert.equal(lock.version, '1.17.0');
        assert.equal(lock.packages[''].version, '1.17.0');
        assert.equal(git('status', '--porcelain'), '');
        const pushes = workflow.match(/^\s*git push .+$/gm)?.map((line) => line.trim());
        assert.deepEqual(pushes, ['git push origin ${{ steps.version.outputs.tag_name }}']);
        assert.ok(workflow.includes('ref: ${{ needs.create-release.outputs.tag_name }}'));
    });
});
