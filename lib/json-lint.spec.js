var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    jsonLint = require('./json-lint'),
    expect = Code.expect,
    it = lab.it;

describe('json-lint', function () {
    var badJsonFilename = '/path/to/badfile.json',
        badJson = '{"foo":"bar" "fizz": "buzz"}',
        file = new RegExp(badJsonFilename);


    it('should add file name to error', function (done) {
        var throws = function () {
            jsonLint.parse(badJson, badJsonFilename);
        };

        expect(throws).throw(Error, file);
        done();
    });

    it('should not need a file name', function (done) {
        var throws = function () {
            jsonLint.parse(badJson);
        };

        expect(throws).throw(Error, !file);
        done();
    });
});
