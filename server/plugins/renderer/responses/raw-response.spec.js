'use strict';

const Code = require('code');
const Lab = require('@hapi/lab');
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
    let request;
    let response;
    let reply;

    lab.beforeEach(() => {
        request = {
            url: {path: '/'},
            app: {themeConfig: {variationIndex: 1}},
        };

        response = {
            code: () => response,
            header: sinon.spy(),
        };

        reply = sinon.stub().returns(response);
    });

    lab.describe('respond()', () => {
        it('should respond', () => {
            const rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.called).to.be.true();
        });

        it('should append checkout css if is the checkout page', () => {
            request.url.path = '/checkout.php?blah=blah';
            const rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.lastCall.args[0]).to.contain(`<link href="/stencil/${Utils.int2uuid(1)}/${Utils.int2uuid(2)}/css/checkout.css"`);
        });

        it('should not append transfer-encoding header', () => {
            const rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(response.header.neverCalledWith('transfer-encoding')).to.be.true();
            expect(response.header.calledWith('content-type')).to.be.true();
        });
    });
});
