const Hapi = require('@hapi/hapi');
const inert = require('@hapi/inert');
const h2o2 = require('@hapi/h2o2');
const router = require('./router.module');

describe('Router', () => {
    const SERVER_OPTIONS = {
        port: 3000,
    };
    const ROUTER_OPTIONS = {
        storeUrl: 'https://store-abc124.mybigcommerce.com',
        normalStoreUrl: 'http://s1234567890.mybigcommerce.com',
        port: SERVER_OPTIONS.port,
    };

    const server = new Hapi.Server(SERVER_OPTIONS);
    const RendererPluginMock = {
        register(_server) {
            _server.expose('implementation', (request, h) => h.response('RendererHandlerFired'));
        },
        name: 'Renderer',
        version: '0.0.1',
    };
    const ThemeAssetsMock = {
        register(_server) {
            _server.expose('cssHandler', (request, h) => h.response('CssHandlerFired'));
            _server.expose('assetHandler', (request, h) => h.response('assetHandlerFired'));
        },
        name: 'ThemeAssets',
        version: '0.0.1',
    };

    beforeAll(async () => {
        await server.register([
            inert,
            h2o2,
            RendererPluginMock,
            ThemeAssetsMock,
            { plugin: router, options: ROUTER_OPTIONS },
        ]);

        await server.start();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should call the Renderer handler', async () => {
        const options = {
            method: 'GET',
            url: '/test',
        };

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(200);
        expect(response.payload).toEqual('RendererHandlerFired');
    });

    it('should call the CSS handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/css/file.css',
        };

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(200);
        expect(response.payload).toEqual('CssHandlerFired');
    });

    it('should call the assets handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/js/file.js',
        };

        const response = await server.inject(options);

        expect(response.statusCode).toEqual(200);
        expect(response.payload).toEqual('assetHandlerFired');
    });

    it('should inject host and origin headers for GraphQL requests', async () => {
        const options = {
            method: 'POST',
            url: '/graphql',
            headers: { authorization: 'auth123' },
        };

        const response = await server.inject(options);

        expect(response.request.payload.headers).toMatchObject({
            authorization: 'auth123',
            origin: 'https://store-abc124.mybigcommerce.com',
            host: 'store-abc124.mybigcommerce.com',
        });
    });
});
