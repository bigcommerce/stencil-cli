'use strict';

const Code = require('code');
const Lab = require('lab');
const sinon = require('sinon');
const RawResponse = require('./raw-response');
const Utils = require('../../../lib/utils');
const lab = exports.lab = Lab.script();
const expect = Code.expect;
const it = lab.it;

lab.describe('RawResponse', () => {
    const data = new Buffer('<html><head></head><body>hello</body></html>');

    const headers = {
        'content-type': 'html/text',
    };

    const statusCode = 200;
    var request;
    var response;
    var reply;

    lab.beforeEach(done => {
        request = {
            url: {path: '/'},
            app: {themeConfig: {variationIndex: 1}},
        };

        response = {
            code: () => response,
            header: sinon.spy(),
        };

        reply = sinon.stub().returns(response);
        done();
    });

    lab.describe('respond()', () => {
        it('should respond', done => {
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.called).to.be.true();

            done();
        });

        it('should append checkout css if is the checkout page', done => {
            request.url.path = '/checkout.php?blah=blah';
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.lastCall.args[0]).to.contain(`<link href="/stencil/${Utils.int2uuid(1)}/${Utils.int2uuid(2)}/css/checkout.css"`);

            done();
        });

        it('should not append transfer-encoding header', done => {
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(response.header.neverCalledWith('transfer-encoding')).to.be.true();
            expect(response.header.calledWith('content-type')).to.be.true();

            done();
        });
    });
});
