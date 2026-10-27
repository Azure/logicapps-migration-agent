import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';

const workflow = fs.readFileSync(
    path.resolve(__dirname, '../../../.github/workflows/version-release.yml'),
    'utf8'
);
const versionPrStep = workflow
    .split("- name: 'Create Version Bump PR'")[1]
    ?.split('\n    release-check:')[0]
    ?.match(/run: \|\r?\n([\s\S]*)/)?.[1];
assert.ok(versionPrStep, 'Version bump PR step must exist');

describe('Release workflow', () => {
    it('opens a version bump PR and dispatches the required migration checks', () => {
        assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
        assert.match(versionPrStep, /git push origin "\$VERSION_BRANCH"/);
        assert.match(versionPrStep, /gh pr create/);
        assert.match(versionPrStep, /--base "\$RELEASE_BRANCH"/);
        assert.match(
            versionPrStep,
            /gh workflow run migration-tests\.yml --ref "\$VERSION_BRANCH"/
        );
        assert.doesNotMatch(versionPrStep, /git push origin "HEAD:refs\/heads\/\$RELEASE_BRANCH"/);
        assert.ok(
            versionPrStep.indexOf('npm test') < versionPrStep.indexOf('git push origin'),
            'migration tests must pass before pushing the version branch'
        );
    });

    it('serializes releases on the same branch without cancelling active runs', () => {
        assert.match(workflow, /group: version-release-\$\{\{ github\.ref \}\}/);
        assert.match(workflow, /cancel-in-progress: false/);
    });

    it('creates a release only after a merged version bump has an untagged version', () => {
        assert.match(workflow, /push:\s+branches:\s+- main\s+- master\s+- 'hotfix\/\*\*'/);
        assert.match(workflow, /if: github\.event_name == 'push'/);
        assert.match(workflow, /git rev-parse --verify "refs\/tags\/\$TAG_NAME"/);
        assert.match(
            workflow,
            /needs\.release-check\.outputs\.should_release == 'true'/
        );
        assert.match(workflow, /ref: \$\{\{ needs\.create-release\.outputs\.tag_name \}\}/);
    });
});
