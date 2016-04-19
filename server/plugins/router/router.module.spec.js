var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var expect = Code.expect;
var it = lab.it;
var router = require('./router.module');

describe('Router', function () {
    var server = new Hapi.Server(),
        RendererPluginMock = {
            register: function(server, options, next) {
                server.expose('implementation', function(request, reply) {
                    return reply('RendererHandlerFired');
                });

                next();
            }
        },
        ThemeAssetsMock = {
            register: function(server, options, next) {
                server.expose('cssHandler', function(request, reply) {
                    return reply('CssHandlerFired');
                });

                server.expose('assetHandler', function(request, reply) {
                    return reply('assetHandlerFired');
                });

                next();
            }
        };

    RendererPluginMock.register.attributes = {
        name: 'Renderer',
        version: '0.0.1'
    };

    ThemeAssetsMock.register.attributes = {
        name: 'ThemeAssets',
        version: '0.0.1'
    };

    server.connection({
        port: 3000
    });

    lab.before(function(done) {
        server.register([
            RendererPluginMock,
            ThemeAssetsMock,
            router
        ], function (err) {
            expect(err).to.equal(undefined);
            server.start(done);
        });
    });

    lab.after(function(done) {
        server.stop(done);
    });

    it('should call the Renderer handler', function (done) {
        server.inject({
            method: 'GET',
            url: '/test'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('RendererHandlerFired');

            done();
        });
    });

    it('should call the CSS handler', function (done) {
        server.inject({
            method: 'GET',
            url: '/stencil/123/234/css/file.css'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('CssHandlerFired');

            done();
        });
    });

    it('should call the assets handler', function (done) {
        server.inject({
            method: 'GET',
            url: '/stencil/123/234/js/file.js'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.payload).to.equal('assetHandlerFired');

            done();
        });
    });
});
