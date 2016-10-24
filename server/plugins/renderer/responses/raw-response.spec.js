'use strict';

var _ = require('lodash');
var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');
var Path = require('path');
var sinon = require('sinon');
var Wreck = require('wreck');
var RawResponse = require('./raw-response');
var lab = exports.lab = Lab.script();
var expect = Code.expect;
var it = lab.it;

lab.describe('RawResponse', function () {
    var data = new Buffer('<html><head></head><body>hello</body></html>');

    var headers = {
        'content-type': 'html/text',
    };

    var statusCode = 200;

    var request;
    var response;
    var reply;

    lab.beforeEach(function (done) {
        request = {
            url: {path: '/'},
            app: {themeConfig: {variationIndex: 1}},
        };

        response = {
            code: function () { return response; },
            header: sinon.spy(),
        };

        reply = sinon.stub().returns(response);
        done();
    });

    lab.describe('respond()', function () {

        it('should respond', function (done) {
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.called).to.be.true();

            done();
        });

        it('should append checkout css if is the checkout page', function (done) {
            request.url.path = '/checkout.php?blah=blah';
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(reply.lastCall.args[0]).to.contain('<link href="/stencil/theme/2/css/checkout.css"');

            done();
        });

        it('should not append transfer-encoding header', function (done) {
            var rawResponse = new RawResponse(data, headers, statusCode);

            rawResponse.respond(request, reply);

            expect(response.header.neverCalledWith('transfer-encoding')).to.be.true();
            expect(response.header.calledWith('content-length')).to.be.true();
            expect(response.header.calledWith('content-type')).to.be.true();

            done();
        });
    });
});
