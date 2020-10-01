const fetchMock = require('node-fetch');
const path = require('path');

const Server = require('../../index');

// eslint-disable-next-line node/no-unpublished-require,global-require
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

describe('Renderer Plugin', () => {
    let server;

    beforeAll(async () => {
        // Prevent littering the console
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());

        const options = {
            dotStencilFile: {
                storeUrl: 'https://store-abc123.mybigcommerce.com',
                normalStoreUrl: 'http://s123456789.mybigcommerce.com',
                port: 4000,
                username: 'testUser',
                token: '6832b1c755bb9de13aa8990216a69a7623043fd7',
            },
            useCache: false,
            themePath: path.join(process.cwd(), 'test/_mocks/themes/valid'),
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

    afterEach(() => {
        jest.resetAllMocks();
        fetchMock.mockReset();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should handle fatal errors in the BCApp request', async () => {
        const options = {
            method: 'GET',
            url: '/test',
        };
        fetchMock.mock('*', { throws: new Error('failure') });

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(500);
    });

    it('should handle responses of a 500 in the BCApp request', async () => {
        const options = {
            method: 'GET',
            url: '/',
        };
        fetchMock.mock('*', 500);

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(500);
    });

    it('should handle redirects in the BCApp request', async () => {
        const options = {
            method: 'GET',
            url: '/',
        };
        const redirectResponse = {
            status: 301,
            headers: {
                location: 'http://www.example.com/',
            },
        };
        fetchMock.mock('*', redirectResponse);

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(301);
        expect(response.headers.location).toEqual(redirectResponse.headers.location);
    });

    it('should handle unauthorized in the Stapler Request', async () => {
        const options = {
            method: 'GET',
            url: '/',
        };
        const unauthorizedResponse = {
            status: 401,
            headers: {
                location: 'http://www.example.com/',
            },
        };
        fetchMock.mock('*', unauthorizedResponse);

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(401);
    });
});
