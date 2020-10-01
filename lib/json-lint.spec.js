const jsonLint = require('./json-lint');

describe('json-lint', () => {
    const badJsonFilename = '/path/to/badfile.json';
    const badJson = '{"foo":"bar" "fizz": "buzz"}';
    const file = new RegExp(badJsonFilename);

    it('should add file name to error', () => {
        const throws = () => {
            jsonLint.parse(badJson, badJsonFilename);
        };

        expect(throws).toThrow(Error, file);
    });

    it('should not need a file name', () => {
        const throws = () => {
            jsonLint.parse(badJson);
        };

        expect(throws).toThrow(Error, !file);
    });
});
