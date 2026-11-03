import './setup';
import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';

const suite = process.argv[2];
if (suite !== 'unit' && suite !== 'integration') {
    throw new Error('Usage: node out/test/runTest.js <unit|integration>');
}

const directory = path.join(__dirname, suite);
const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.test.js'))
    .sort();
if (files.length === 0) {
    throw new Error(`No ${suite} tests found in ${directory}`);
}

const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000,
    failZero: true,
    forbidOnly: true,
    forbidPending: true,
});
for (const file of files) {
    mocha.addFile(path.join(directory, file));
}
mocha.run((failures) => {
    process.exitCode = failures === 0 ? 0 : 1;
});
