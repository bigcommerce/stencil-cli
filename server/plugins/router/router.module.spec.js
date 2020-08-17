const Code = require('code');
const Hapi = require('@hapi/hapi');
const Lab = require('@hapi/lab');

const router = require('./router.module');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;

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
        register (server) {
            server.expose('implementation', (request, h) => h.response('RendererHandlerFired'));
        },
        name: 'Renderer',
        version: '0.0.1',
    };
    const ThemeAssetsMock = {
        register (server) {
            server.expose('cssHandler', (request, h) => h.response('CssHandlerFired'));
            server.expose('assetHandler', (request, h) => h.response('assetHandlerFired'));
        },
        name: 'ThemeAssets',
        version: '0.0.1',
    };

    lab.before(async () => {
        await server.register([
            require('@hapi/inert'),
            require('@hapi/h2o2'),
            RendererPluginMock,
            ThemeAssetsMock,
            { plugin: router, options: ROUTER_OPTIONS },
        ]);

        await server.start();
    });

    lab.after(async () => {
        await server.stop();
    });

    it('should call the Renderer handler', async () => {
        const options = {
            method: 'GET',
            url: '/test',
        };

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('RendererHandlerFired');
    });

    it('should call the CSS handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/css/file.css',
        };

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('CssHandlerFired');
    });

    it('should call the assets handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/js/file.js',
        };

        const response = await server.inject(options);

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('assetHandlerFired');
    });

    it('should inject host and origin headers for GraphQL requests', async () => {
        const options = {
            method: 'POST',
            url: '/graphql',
            headers: { 'authorization': 'auth123' },
        };

        const response = await server.inject(options);

        expect(response.request.payload.headers).to.include({
            authorization: 'auth123',
            origin: 'https://store-abc124.mybigcommerce.com',
            host: 'store-abc124.mybigcommerce.com',
        });
    });
});
