const jsonLint = require('./json-lint');

describe('json-lint', function () {
    const badJsonFilename = '/path/to/badfile.json';
    const badJson = '{"foo":"bar" "fizz": "buzz"}';
    const file = new RegExp(badJsonFilename);


    it('should add file name to error', () => {
        const throws = function () {
            jsonLint.parse(badJson, badJsonFilename);
        };

        expect(throws).toThrow(Error, file);
    });

    it('should not need a file name', () => {
        const throws = function () {
            jsonLint.parse(badJson);
        };

        expect(throws).toThrow(Error, !file);
    });
});
