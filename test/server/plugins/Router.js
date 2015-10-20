var Code = require('code'),
    Hapi = require('hapi'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it,
    internals = {
        paths: {
            pluginsPath: './../../server/plugins'
        }
    };

lab.describe('Router', function () {
    var server = new Hapi.Server(),
        RendererPluginMock = {
            register: function(server, options, next) {
                server.expose('implementation', function(request, reply) {
                    return reply('RendererHandlerFired');
                });

                next();
            }
        },
        ProxyPluginMock = {
            register: function(server, options, next) {
                server.expose('implementation', function(request, reply) {
                    return reply('ProxyHandlerFired');
                });

                next();
            }
        };

    RendererPluginMock.register.attributes = {
        name: 'Renderer',
        version: '0.0.1'
    };

    ProxyPluginMock.register.attributes = {
        name: 'Proxy',
        version: '0.0.1'
    };

    server.connection({port: 3000});

    lab.before(function(done) {
        server.register([
            RendererPluginMock,
            ProxyPluginMock,
            require(internals.paths.pluginsPath + '/Router')
        ], function (err) {
            expect(err).to.equal(undefined);
            server.start(done);
        });
    });

    lab.after(function(done) {
        server.stop(done);
    });

    it('should call the proxy handler', function (done) {
        server.inject({
            method: 'POST',
            url: '/test'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.request.url.path).to.equal('/__proxy__/test');

            done();
        });
    });

    it('should call the proxy handler when checkout.php is called', function (done) {
        server.inject({
            method: 'GET',
            url: '/checkout.php'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.request.url.path).to.equal('/__proxy__/checkout.php');
            expect(response.payload).to.equal('ProxyHandlerFired');

            done();
        });
    });

    it('should not call the proxy handler when just a GET', function (done) {
        server.inject({
            method: 'GET',
            url: '/test'
        }, function (response) {
            expect(response.statusCode).to.equal(200);
            expect(response.request.url.path).to.not.equal('/__proxy__/test');

            done();
        });
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
