const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;
const router = require('./router.module');

describe('Router', () => {
    var server = new Hapi.Server();
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

    lab.before(done => {
        server.register([
            RendererPluginMock,
            ThemeAssetsMock,
            router,
        ], err => {
            expect(err).to.equal(undefined);
            server.start(done);
        });
    });

    lab.after(done => {
        server.stop(done);
    });

    it('should call the Renderer handler', done => {
        server.inject({
            method: 'GET',
            url: '/test',
        }, response => {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('RendererHandlerFired');

            done();
        });
    });

    it('should call the CSS handler', done => {
        server.inject({
            method: 'GET',
            url: '/stencil/123/css/file.css',
        }, response => {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('CssHandlerFired');

            done();
        });
    });

    it('should call the assets handler', done => {
        server.inject({
            method: 'GET',
            url: '/stencil/123/js/file.js',
        }, response => {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('assetHandlerFired');

            done();
        });
    });

    it('should inject host and origin headers for GraphQL requests', done => {
        server.inject({
            method: 'POST',
            url: '/graphql',
            headers: { 'authorization': 'abc123' },
        }, response => {
            expect(response.request.payload.headers).to.include(
                {
                    authorization: 'abc123',
                    origin: 'https://store-abc123.mybigcommerce.com',
                    host: 'store-abc123.mybigcommerce.com',
                },
            );
            done();
        });
    });
});
