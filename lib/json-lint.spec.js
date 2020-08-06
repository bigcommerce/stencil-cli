const Code = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const jsonLint = require('./json-lint');
const expect = Code.expect;
const it = lab.it;

describe('json-lint', function () {
    const badJsonFilename = '/path/to/badfile.json';
    const badJson = '{"foo":"bar" "fizz": "buzz"}';
    const file = new RegExp(badJsonFilename);


    it('should add file name to error', () => {
        const throws = function () {
            jsonLint.parse(badJson, badJsonFilename);
        };

        expect(throws).throw(Error, file);
    });

    it('should not need a file name', () => {
        const throws = function () {
            jsonLint.parse(badJson);
        };

        expect(throws).throw(Error, !file);
    });
});
