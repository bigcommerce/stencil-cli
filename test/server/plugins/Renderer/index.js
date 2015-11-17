'use strict';

var _ = require('lodash'),
    Code = require('code'),
    Hapi = require('hapi'),
    Lab = require('lab'),
    Path = require('path'),
    sinon = require('sinon'),
    Wreck = require('wreck'),
    StencilCLI = require('../../../../server'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it;

lab.describe('Renderer Plugin', function () {
    var options = {
            dotStencilFile: {
                storeUrl: "https://store-abc123.mybigcommerce.com",
                normalStoreUrl: "http://s123456789.mybigcommerce.com",
                port: 4000,
                apiKey: "abc123",
                useCache: false
            }
        },
        server,
        wreckRequestStub,
        wreckReadStub;

    lab.before(function (done) {
        StencilCLI(options, function(err , srv) {
           server = srv;

            // Don't log errors during the test
            server.ext('onPostHandler', function (request, reply) {
                if (request.response.isBoom) {
                    return reply().code(500);
                }

                reply.continue();
            });

            done();
        });
    });

    lab.beforeEach(function (done) {
        wreckRequestStub = sinon.stub(Wreck, 'request');
        wreckReadStub = sinon.stub(Wreck, 'read');

        done();
    });

    lab.afterEach(function (done) {
        wreckRequestStub.restore();
        wreckReadStub.restore();

        done();
    });

    it('should handle fatal errors in the BCApp request', function (done) {
        var options = {
            method: "GET",
            url: "/test"
        };

        wreckRequestStub.callsArgWith(3, new Error('failure'));

        server.inject(options, function (response) {
            expect(response.statusCode).to.equal(500);

            done();
        });
    });


    it('should handle responses of a 500 in the BCApp request', function (done) {
        var options = {
            method: "GET",
            url: "/"
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 500
        });

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(500);

            done();
        });
    });

    it('should handle redirects in the BCApp request', function (done) {
        var options = {
            method: "GET",
            url: "/"
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 301,
            headers: {
                location: 'http://www.example.com/'
            }
        });

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(301);
            expect(response.headers.location).to.equal('http://www.example.com/');

            done();
        });
    });

    it('should handle redirects in the BCApp request', function (done) {
        var options = {
            method: "GET",
            url: "/"
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 301,
            headers: {
                location: 'http://www.example.com/'
            }
        });

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(301);
            expect(response.headers.location).to.equal('http://www.example.com/');

            done();
        });
    });
});
