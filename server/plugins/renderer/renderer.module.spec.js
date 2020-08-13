'use strict';

const Code = require('code');
const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Wreck = require('wreck');
const Path = require('path');

const Server = require('../../../server');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const it = lab.it;

lab.describe('Renderer Plugin', () => {
    let server;
    let wreckRequestStub;
    let wreckReadStub;

    lab.before(async () => {
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

        server = await Server.create(options);

        // Don't log errors during the test
        server.ext('onPostHandler', (request, h) => {
            if (request.response.isBoom) {
                return h.response().code(500);
            }
            return h.continue;
        });
    });

    lab.beforeEach(() => {
        wreckRequestStub = sinon.stub(Wreck, 'request');
        wreckReadStub = sinon.stub(Wreck, 'read');
    });

    lab.afterEach(async () => {
        wreckRequestStub.restore();
        wreckReadStub.restore();
    });

    lab.after(async () => {
        await server.stop();
    });

    it('should handle fatal errors in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/test",
        };

        wreckRequestStub.callsArgWith(3, new Error('failure'));

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });

    it('should handle responses of a 500 in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        wreckRequestStub.callsArgWith(3, null, { statusCode: 500 });

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(500);
    });

    it('should handle redirects in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 301,
            headers: {
                location: 'http://www.example.com/',
            },
        });

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(301);
        expect(response.headers.location).to.equal('http://www.example.com/');
    });

    it('should handle unauthorized in the Stapler Request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        wreckRequestStub.callsArgWith(3, null, {
            statusCode: 401,
            headers: {
                location: 'http://www.example.com/',
            },
        });

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(401);
    });
});
