const Code = require('code');
const Hapi = require('hapi');
const Lab = require('@hapi/lab');
const { promisify } = require('util');

const router = require('./router.module');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;

describe('Router', () => {
    const server = new Hapi.Server();
    const RendererPluginMock = {
        register: function(server, options, next) {
            server.expose('implementation', (request, reply) => reply('RendererHandlerFired'));

            next();
        },
    };
    const ThemeAssetsMock = {
        register: function(server, options, next) {
            server.expose('cssHandler', (request, reply) => reply('CssHandlerFired'));
            server.expose('assetHandler', (request, reply) => reply('assetHandlerFired'));

            next();
        },
    };

    RendererPluginMock.register.attributes = {
        name: 'Renderer',
        version: '0.0.1',
    };

    ThemeAssetsMock.register.attributes = {
        name: 'ThemeAssets',
        version: '0.0.1',
    };

    server.connection({
        port: 3000,
    });

    lab.before(async () => {
        await promisify(server.register.bind(server))([
            RendererPluginMock,
            ThemeAssetsMock,
            router,
        ]);

        await promisify(server.start.bind(server))();
    });

    lab.after(async () => {
        await promisify(server.stop.bind(server))();
    });

    it('should call the Renderer handler', async () => {
        const options = {
            method: 'GET',
            url: '/test',
        };

        const response = await new Promise(resolve =>
            server.inject(options, resolve),
        );

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('RendererHandlerFired');
    });

    it('should call the CSS handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/css/file.css',
        };

        const response = await new Promise(resolve =>
            server.inject(options, resolve),
        );

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('CssHandlerFired');
    });

    it('should call the assets handler', async () => {
        const options = {
            method: 'GET',
            url: '/stencil/123/js/file.js',
        };

        const response = await new Promise(resolve =>
            server.inject(options, resolve),
        );

        expect(response.statusCode).to.equal(200);
        expect(response.payload).to.equal('assetHandlerFired');
    });

    it('should inject host and origin headers for GraphQL requests', async () => {
        const options = {
            method: 'POST',
            url: '/graphql',
            headers: { 'authorization': 'abc123' },
        };

        const response = await new Promise(resolve =>
            server.inject(options, resolve),
        );

        expect(response.request.payload.headers).to.include(
            {
                authorization: 'abc123',
                origin: 'https://store-abc123.mybigcommerce.com',
                host: 'store-abc123.mybigcommerce.com',
            },
        );
    });
});
