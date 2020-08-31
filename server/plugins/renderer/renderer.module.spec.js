'use strict';

const Wreck = require('wreck');
const Path = require('path');

const Server = require('../../../server');

describe('Renderer Plugin', () => {
    let server;
    let wreckRequestStub;

    beforeAll(async () => {
        // Prevent littering the console
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());

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

        wreckRequestStub = jest.spyOn(Wreck, 'request').mockImplementation(jest.fn());
        jest.spyOn(Wreck, 'read').mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should handle fatal errors in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/test",
        };
        wreckRequestStub.mockImplementation((method, url, options, cb) => cb(new Error('failure')));

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(500);
    });

    it('should handle responses of a 500 in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        wreckRequestStub.mockImplementation((method, url, options, cb) => cb(null, { statusCode: 500 }));

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(500);
    });

    it('should handle redirects in the BCApp request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        const redirectResponse = {
            statusCode: 301,
            headers: {
                location: 'http://www.example.com/',
            },
        };
        wreckRequestStub.mockImplementation((method, url, options, cb) => cb(null, redirectResponse));

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(301);
        expect(response.headers.location).toEqual('http://www.example.com/');
    });

    it('should handle unauthorized in the Stapler Request', async () => {
        const options = {
            method: "GET",
            url: "/",
        };
        const unauthorizedResponse = {
            statusCode: 401,
            headers: {
                location: 'http://www.example.com/',
            },
        };
        wreckRequestStub.mockImplementation((method, url, options, cb) => cb(null, unauthorizedResponse));

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(401);
    });
});
