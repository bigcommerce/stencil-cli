var Boom = require('boom'),
    Code = require('code'),
    Hapi = require('hapi'),
    Lab = require('lab'),
    Sinon = require('sinon'),
    Url = require('url'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it,
    describe = lab.describe,
    internals = {
        paths: {
            pluginsPath: './../../server/plugins'
        }
    };

describe('Proxy', function () {
    var server = new Hapi.Server(),
        replyResponseMock = {
            code: function() {},
            header: function() {}
        },
        requestMock = {
            app: {
                storeUrl: 'https://mystore.com'
            },
            params: {
                url: '/my-url'
            },
            headers: {
                host: 'localhost:3000'
            },
            url: {
                search: ''
            }
        },
        replyMock = function() {
            return replyResponseMock;
        },
        replySpy,
        replyProxySpy,
        replyResponseCodeSpy,
        replyResponseHeaderSpy;

    replyMock.redirect = function() {
        return replyResponseMock;
    };

    replyMock.proxy = function() {
        return replyResponseMock;
    };

    replySpy = Sinon.spy(replyMock);
    replyProxySpy = Sinon.spy(replyMock, 'proxy');
    replyResponseCodeSpy = Sinon.spy(replyResponseMock, 'code');
    replyResponseHeaderSpy = Sinon.spy(replyResponseMock, 'header');

    server.connection({port: 3000});

    lab.before(function(done) {
        server.register([{
            register: require(internals.paths.pluginsPath + '/Proxy')
        }], function (err) {
            expect(err).to.equal(undefined);
            done();
        });
    });

    it('should set correct basic proxy config', function (done) {
        var config = {
                passThrough: true,
                localStatePassThrough: true,
                redirects: false,
                rejectUnauthorized: false
            },
            actualConfig;

        server.plugins.Proxy.implementation(requestMock, replyMock);

        actualConfig = replyProxySpy.args[0][0];

        expect(actualConfig).to.include(config);

        done();
    });

    it('should call mapUri properly', function(done) {
        var actualConfig,
            mapUriCallback = Sinon.spy(),
            url = Url.resolve(requestMock.app.storeUrl, requestMock.params.url);

        server.plugins.Proxy.implementation(requestMock, replyMock);

        actualConfig = replyProxySpy.args[0][0];
        actualConfig.mapUri(requestMock, mapUriCallback);

        expect(mapUriCallback.calledWith(null, url)).to.equal(true);

        done();
    });

    describe('different onResponse scenarios', function() {
        it('should properly write statusCode', function(done) {
            var actualConfig,
                responseMock = {
                    statusCode: 200,
                    headers: []
                };

            server.plugins.Proxy.implementation(requestMock, replyMock);

            actualConfig = replyProxySpy.args[0][0];
            actualConfig.onResponse(null, responseMock, requestMock, replyMock);

            expect(replyResponseCodeSpy.calledWith(200)).to.equal(true);

            done();
        });

        it('should properly rewrite cookies', function(done) {
            var actualConfig,
                responseMock = {
                    statusCode: 200,
                    headers: {
                        'set-cookie': [
                            'SHOP_SESSION_TOKEN=abc123; path=/; domain=.mystore.com; HttpOnly',
                            'fornax_lastIdentify=abc123; path=/; domain=.mystore.com'
                        ]
                    }
                };

            server.plugins.Proxy.implementation(requestMock, replyMock);

            actualConfig = replyProxySpy.args[0][0];
            actualConfig.onResponse(null, responseMock, requestMock, replyMock);

            expect(replyResponseHeaderSpy.calledWith('set-cookie', [
                'SHOP_SESSION_TOKEN=abc123; path=/; HttpOnly',
                'fornax_lastIdentify=abc123; path=/'
            ])).to.equal(true);

            done();
        });

        it('should set correct location header if location is in passed in headers', function(done) {
            var actualConfig,
                responseMock = {
                    statusCode: 301,
                    headers: {
                        location: 'http://mystore.com/redirect-thingy',
                        'set-cookies': []
                    }
                };

            server.plugins.Proxy.implementation(requestMock, replyMock);

            actualConfig = replyProxySpy.args[0][0];
            actualConfig.onResponse(null, responseMock, requestMock, replyMock);

            expect(replyResponseHeaderSpy.calledWith('location', 'http://localhost:3000/redirect-thingy'));
            expect(replyResponseCodeSpy.calledWith(301));

            done();
        });

        it ('should trigger boom if callback in onResponse has an error', function(done) {
            var actualConfig,
                error = new Error('Ouch!'),
                responseMock = {};

            server.plugins.Proxy.implementation(requestMock, replyMock);

            actualConfig = replyProxySpy.args[0][0];
            actualConfig.onResponse(error, responseMock, requestMock, replySpy);

            expect(replySpy.calledWith(Boom.wrap(error))).to.equal(true);

            done();
        });
    });
});
