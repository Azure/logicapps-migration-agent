import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';

const workflow = fs.readFileSync(
    path.resolve(__dirname, '../../../.github/workflows/version-release.yml'),
    'utf8'
);
const commitStep = workflow.match(
    /- name: 'Commit Version Bump'[\s\S]*?run: \|\r?\n([\s\S]*?)(?=\r?\n\s*- name:)/
)?.[1];
assert.ok(commitStep, 'Version bump step must exist');
const script = commitStep.replace(/^ {18}/gm, '');
const bash =
    process.platform === 'win32'
        ? path.resolve(
              execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
              '../../../bin/bash.exe'
          )
        : 'bash';

function runCommit(
    options: {
        pushFailures?: number;
        rebaseFails?: boolean;
        testFailureAt?: number;
        upstreamChanges?: boolean;
    } = {}
) {
    return spawnSync(
        bash,
        [
            '-e',
            '-c',
            `
pushes=0
rebases=0
tests=0
git() {
  echo "git $*" >&2
  case "$1" in
    rev-parse) echo "$rebases" ;;
    rebase)
      ${options.rebaseFails ? 'return 1' : ':'}
      ${options.upstreamChanges ? 'rebases=$((rebases + 1))' : ':'}
      ;;
    push)
      pushes=$((pushes + 1))
      if [ "$pushes" -le "${options.pushFailures ?? 0}" ]; then return 1; fi
      ;;
  esac
  return 0
}
npm() {
  echo "npm $*" >&2
  if [ "$1" = test ]; then
    tests=$((tests + 1))
    if [ "$tests" -eq "${options.testFailureAt ?? 0}" ]; then return 1; fi
  fi
  return 0
}
sleep() { :; }
${script.replace(/\$\{\{ steps\.version\.outputs\.new_version \}\}/g, '1.17.0')}
`,
        ],
        {
            encoding: 'utf8',
            env: { ...process.env, RELEASE_BRANCH: 'main' },
        }
    );
}

describe('Release version bump', () => {
    it('serializes releases on the same branch without cancelling an active release', () => {
        assert.match(workflow, /group: version-release-\$\{\{ github\.ref \}\}/);
        assert.match(workflow, /cancel-in-progress: false/);
    });

    it('tests before committing both version files and pushes without force', () => {
        const result = runCommit();
        assert.equal(result.status, 0, result.stderr);
        assert.match(
            result.stderr,
            /npm ci --ignore-scripts\nnpm test\ngit add package.json package-lock.json\ngit commit/
        );
        assert.match(
            result.stderr,
            /git fetch origin main\ngit rebase origin\/main\ngit rev-parse HEAD\ngit push origin HEAD:refs\/heads\/main/
        );
        assert.doesNotMatch(result.stderr, /--force/);
    });

    it('rebases and reruns migration tests before retrying a rejected push', () => {
        const result = runCommit({ pushFailures: 1, upstreamChanges: true });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr.match(/git push /g)?.length, 2);
        assert.equal(result.stderr.match(/git rebase /g)?.length, 2);
        assert.equal(result.stderr.match(/npm test/g)?.length, 3);
    });

    it('does not create a version commit when migration tests fail', () => {
        const result = runCommit({ testFailureAt: 1 });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.stderr, /git commit|git push/);
    });

    it('does not push if rebasing fails', () => {
        const result = runCommit({ rebaseFails: true });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.stderr, /git push/);
    });

    it('does not push if migration tests fail after rebasing', () => {
        const result = runCommit({ upstreamChanges: true, testFailureAt: 2 });
        assert.notEqual(result.status, 0);
        assert.equal(result.stderr.match(/npm test/g)?.length, 2);
        assert.doesNotMatch(result.stderr, /git push/);
    });

    it('fails explicitly after three rejected pushes', () => {
        const result = runCommit({ pushFailures: 3 });
        assert.notEqual(result.status, 0);
        assert.equal(result.stderr.match(/git push /g)?.length, 3);
        assert.match(result.stdout, /::error::Unable to push the version bump after 3 attempts/);
    });
});
