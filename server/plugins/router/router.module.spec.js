var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var expect = Code.expect;
var it = lab.it;
var router = require('./router.module');

describe('Router', () => {
    var server = new Hapi.Server(),
        RendererPluginMock = {
            register: function(server, options, next) {
                server.expose('implementation', (request, reply) => reply('RendererHandlerFired'));

                next();
            },
        },
        ThemeAssetsMock = {
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
});
