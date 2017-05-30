var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    stencilToken = require('./stencil-token'),
    expect = Code.expect,
    it = lab.it;

describe('stencilToken', function () {
    var options = {
        username: 'testUser',
        token: '12345689DEADBEEF',
        validToken: 'dGVzdFVzZXI6MTIzNDU2ODlERUFEQkVFRg==',
    };

    it('should return a base64 encoded string', function (done) {
        expect(stencilToken.generate(options.username, options.token)).to.be.equal(options.validToken);
        done();
    });

    it('should return an error without credentials', function (done) {
        var throws = function () {
            stencilToken.generate();
        };

        expect(throws).throw(Error);

        done();
    });
});
