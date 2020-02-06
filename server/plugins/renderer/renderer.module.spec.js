'use strict';

const Code = require('code');
const Lab = require('lab');
const sinon = require('sinon');
const Wreck = require('wreck');
const StencilCLI = require('../../index');
const lab = exports.lab = Lab.script();
const expect = Code.expect;
const it = lab.it;
const Path = require('path');

lab.describe('Renderer Plugin', () => {
    let server;
    let wreckRequestStub;
    let wreckReadStub;

    lab.before(done => {
        const options = {
            dotStencilFile: {
                storeUrl: "https://store-abc123.mybigcommerce.com",
                normalStoreUrl: "http://s123456789.mybigcommerce.com",
                port: 4000,
                username: 'testUser',
                token: '6832b1c755bb9de13aa8990216a69a7623043fd7',
            },
            useCache: false,
            themePath: Path.join(process.cwd(), 'test/_mocks/themes/valid'),
        };

        StencilCLI(options, (err , srv) => {
           server = srv;

            // Don't log errors during the test
            server.ext('onPostHandler', (request, reply) => {
                if (request.response.isBoom) {
                    return reply().code(500);
                }

                reply.continue();
            });

            done();
        });
    });

    lab.beforeEach(done => {
        wreckRequestStub = sinon.stub(Wreck, 'request');
        wreckReadStub = sinon.stub(Wreck, 'read');

        done();
    });

    lab.afterEach(done => {
        wreckRequestStub.restore();
        wreckReadStub.restore();

        server.stop(done);
    });

    it('should handle fatal errors in the BCApp request', done => {
        var options = {
            method: "GET",
            url: "/test",
        };

        wreckRequestStub.callsArgWith(3, new Error('failure'));

        server.inject(options, response => {
            expect(response.statusCode).to.equal(500);

            done();
        });
    });

    it('should handle responses of a 500 in the BCApp request', done => {
        var options = {
            method: "GET",
            url: "/",
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 500,
        });

        server.inject(options, response => {
            expect(response.statusCode).to.equal(500);

            done();
        });
    });

    it('should handle redirects in the BCApp request', done => {
        var options = {
            method: "GET",
            url: "/",
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 301,
            headers: {
                location: 'http://www.example.com/',
            },
        });

        server.inject(options, response => {
            expect(response.statusCode).to.equal(301);
            expect(response.headers.location).to.equal('http://www.example.com/');

            done();
        });
    });

    it('should handle unauthorized in the Stapler Request', done => {
        var options = {
            method: "GET",
            url: "/",
        };

        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 401,
            headers: {
                location: 'http://www.example.com/',
            },
        });

        server.inject(options, response => {
            expect(response.statusCode).to.equal(401);

            done();
        });
    });
});
