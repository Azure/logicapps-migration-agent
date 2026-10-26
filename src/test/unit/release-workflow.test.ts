import * as assert from 'assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'version-release.yml'),
    'utf8'
);
const bash =
    process.platform === 'win32'
        ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
        : 'bash';

function stepScript(name: string): string {
    const step = workflow.split(`- name: '${name}'`)[1]?.split(/\r?\n {12}- name:/)[0];
    assert.ok(step, `Missing workflow step: ${name}`);
    const script = step.split(/ {14}run: \|\r?\n/)[1];
    assert.ok(script, `Missing script for workflow step: ${name}`);
    return script.replace(/^ {18}/gm, '');
}

describe('Release workflow', () => {
    let workspace: string;
    let repository: string;
    let remote: string;

    function run(command: string, args: string[], cwd = repository): string {
        const result = spawnSync(command, args, {
            cwd,
            encoding: 'utf8',
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 'Release test',
                GIT_AUTHOR_EMAIL: 'release-test@example.com',
                GIT_COMMITTER_NAME: 'Release test',
                GIT_COMMITTER_EMAIL: 'release-test@example.com',
            },
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${command}: ${result.stdout}\n${result.stderr}`);
        return result.stdout.trim();
    }

    function nextVersion(type: string): string {
        const output = path.join(repository, 'version-output');
        fs.writeFileSync(output, '');
        run(bash, [
            '-c',
            `export GITHUB_OUTPUT=version-output\n${stepScript('Calculate Next Version').replace(
                '${{ github.event.inputs.release_type }}',
                type
            )}`,
        ]);
        return fs.readFileSync(output, 'utf8').match(/^new_version=(.+)$/m)?.[1] || '';
    }

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'release-workflow-'));
        repository = path.join(workspace, 'repository');
        remote = path.join(workspace, 'remote.git');
        fs.mkdirSync(repository);
        run('git', ['init', '--bare', remote]);
        run('git', ['init', '-b', 'main']);
        fs.writeFileSync(
            path.join(repository, 'package.json'),
            JSON.stringify({ name: 'release-workflow-test', version: '1.16.0' })
        );
        run('git', ['add', 'package.json']);
        run('git', ['commit', '-m', 'Initial version']);
        run('git', ['remote', 'add', 'origin', remote]);
        run('git', ['push', '-u', 'origin', 'main']);
    });

    afterEach(() => fs.rmSync(workspace, { recursive: true, force: true }));

    it('publishes the release tag without pushing a stale source branch', () => {
        const releaseSource = run('git', ['rev-parse', 'HEAD']);
        fs.writeFileSync(path.join(repository, 'concurrent.txt'), 'Concurrent main change');
        run('git', ['add', 'concurrent.txt']);
        run('git', ['commit', '-m', 'Advance main while release is running']);
        run('git', ['push', 'origin', 'main']);
        const mainTip = run('git', ['rev-parse', 'HEAD']);
        run('git', ['checkout', '--detach', releaseSource]);
        run('git', ['branch', '-f', 'main', releaseSource]);
        const stalePush = spawnSync('git', ['push', 'origin', 'main'], {
            cwd: repository,
            encoding: 'utf8',
        });
        assert.notEqual(stalePush.status, 0);
        assert.match(stalePush.stderr, /non-fast-forward/);

        const version = nextVersion('minor');
        assert.equal(version, '1.17.0');
        for (const name of [
            'Update package.json version',
            'Commit Version Bump',
            'Create and Push Tag',
        ]) {
            run(bash, [
                '-c',
                stepScript(name)
                    .replaceAll('${{ steps.version.outputs.new_version }}', version)
                    .replaceAll('${{ steps.version.outputs.tag_name }}', `v${version}`)
                    .replaceAll('${{ github.ref_name }}', 'main'),
            ]);
        }
        assert.equal(
            run('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0],
            mainTip
        );
        assert.equal(
            run('git', ['show', `${mainTip}:package.json`]),
            JSON.stringify({ name: 'release-workflow-test', version: '1.16.0' })
        );
        assert.equal(JSON.parse(run('git', ['show', 'v1.17.0:package.json'])).version, '1.17.0');
        assert.ok(run('git', ['ls-remote', 'origin', 'refs/tags/v1.17.0']));
    });

    it('advances from the latest stable tag when the source version is unchanged', () => {
        run('git', ['tag', 'v1.17.0']);
        run('git', ['tag', 'v1.19.0']);
        run('git', ['tag', 'v1.20.0-preview.1']);
        assert.equal(nextVersion('minor'), '1.20.0');
        assert.equal(nextVersion('major'), '2.0.0');
    });

    it('keeps hotfix patch releases on their existing major and minor version', () => {
        run('git', ['tag', 'v1.16.2']);
        run('git', ['tag', 'v1.17.0']);
        assert.equal(nextVersion('patch'), '1.16.3');
    });

    it('finds the previous release by version even when it is not an ancestor', () => {
        run('git', ['checkout', '--detach']);
        fs.writeFileSync(path.join(repository, 'old-release.txt'), 'Tag-only release commit');
        run('git', ['add', 'old-release.txt']);
        run('git', ['commit', '-m', 'Previous tag-only release']);
        run('git', ['tag', 'v1.17.0']);
        run('git', ['checkout', 'main']);
        run('git', ['tag', 'v1.18.0']);
        run('git', ['tag', 'v2.0.0']);
        const script = stepScript('Generate Release Notes')
            .split('if [ -z "$PREV_TAG" ]')[0]
            .replaceAll('${{ steps.version.outputs.tag_name }}', 'v1.18.0');
        assert.equal(run(bash, ['-c', `${script}\nprintf '%s' "$PREV_TAG"`]), 'v1.17.0');
    });

    it('pins release and build checkouts and serializes release creation', () => {
        assert.match(workflow, /group: version-release\s+cancel-in-progress: false/);
        assert.match(workflow.split("name: 'Set up Node.js'")[0], /ref: \$\{\{ github.sha \}\}/);
        assert.match(
            workflow.split('    build-and-publish:')[1],
            /ref: \$\{\{ needs.create-release.outputs.tag_name \}\}/
        );
    });
});
