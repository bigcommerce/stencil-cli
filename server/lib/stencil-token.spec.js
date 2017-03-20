var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    Wreck = require('wreck'),
    sinon = require('sinon'),
    stencilToken = require('./stencil-token'),
    expect = Code.expect,
    it = lab.it;

describe('stencilToken', function () {
    var options = {
        username: 'testUser',
        token: '12345689DEADBEEF',
        validToken: 'dGVzdFVzZXI6MTIzNDU2ODlERUFEQkVFRg=='
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

    it('should return a successful Auth', function (done) {
        var wreckStub = sinon.stub(Wreck, 'request');

        wreckStub.callsArgWith(3, null, {
            statusCode: 200
        });

        stencilToken.getAuth({
            username: options.username,
            token: options.token
        }, function (err, response) {
            console.log(response);
            expect(response.authorized).to.equal(true);
            wreckStub.restore();

            done();
        });
    });

    it('should return an unsuccessful Auth', function (done) {
        var wreckStub = sinon.stub(Wreck, 'request');

        wreckStub.callsArgWith(3, null, {
            statusCode: 401
        });

        stencilToken.getAuth({
            username: options.username,
            token: options.token
        }, function (err, response) {
            expect(response.authorized).to.equal(false);
            wreckStub.restore();

            done();
        });
    });

    it('should throw return an error', function (done) {
        var wreckStub = sinon.stub(Wreck, 'request');

        wreckStub.callsArgWith(3, new Error('Error'), null);

        stencilToken.getAuth({
            username: options.username,
            token: options.token
        }, function (err, response) {
            expect(err).to.not.be.undefined();
            expect(response).to.be.undefined();
            wreckStub.restore();

            done();
        });
    });

    it('should require a function as a callback', function (done) {
        var throws = function () {
            stencilToken.getAuth({});
        };

        expect(throws).throw(Error);

        done();
    })
});
