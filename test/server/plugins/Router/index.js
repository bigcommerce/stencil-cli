var Code = require('code'),
    Hapi = require('hapi'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    expect = Code.expect,
    it = lab.it,
    internals = {
        paths: {
            pluginsPath: './../../../../server/plugins'
        }
    };

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
        CSSPluginMock = {
            register: function(server, options, next) {
                server.expose('implementation', function(request, reply) {
                    return reply('CSSHandlerFired');
                });

                next();
            }
        };

    RendererPluginMock.register.attributes = {
        name: 'Renderer',
        version: '0.0.1'
    };

    CSSPluginMock.register.attributes = {
        name: 'CssCompiler',
        version: '0.0.1'
    };

    server.connection({
        port: 3000
    });

    lab.before(function(done) {
        server.register([
            RendererPluginMock,
            CSSPluginMock,
            require(internals.paths.pluginsPath + '/Router')
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
});
