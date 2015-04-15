var Code = require('code'),
    Hapi = require('hapi'),
    Lab = require('lab'),
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

describe('Router', function () {
    var server = new Hapi.Server(),
        requestMock = {
            app: {
                storeUrl: 'https://mystore.com'
            },
            params: {
                url: '/my-url'
            },
            headers: {
                host: 'localhost:3000'
            }
        },
        responseReplyMock = function(content) {
            return content;
        };


    server.connection({port: 3000});

    lab.before(function(done) {
        server.register([{
            register: require(internals.paths.pluginsPath + '/Proxy')
        }], function (err) {
            expect(err).to.equal(undefined);
            done();
        });
    });

    it('should set correct proxy config', function (done) {
        server.plugins.Proxy.implementation(requestMock, {
            proxy: function(config) {
                expect(config.passThrough).to.equal(true);
                expect(config.localStatePassThrough).to.equal(true);
                expect(config.redirects).to.equal(false);
                expect(config.rejectUnauthorized).to.equal(false);

                done();
            }
        });
    });

    it('should call mapUri properly', function(done) {
        server.plugins.Proxy.implementation(requestMock, {
            proxy: function(config) {
                config.mapUri(requestMock, function(err, uri) {
                    expect(err).to.equal(null);
                    expect(uri).to.equal(Url.resolve(requestMock.app.storeUrl, requestMock.params.url));
                    done();
                });
            }
        });
    });

    describe('different onResponse scenarios', function() {
        it('should properly write statusCode', function(done) {
            var responseMock = {
                    statusCode: 200,
                    headers: []
                };

            responseReplyMock.header = function() {};

            server.plugins.Proxy.implementation(requestMock, {
                proxy: function(config) {
                    config.onResponse(null, responseMock, requestMock, function() {return responseReplyMock});

                    expect(responseReplyMock.statusCode).to.equal(200);

                    done();
                }
            });
        });

        it('should properly rewrite cookies', function(done) {
            var responseMock = {
                    statusCode: 200,
                    headers: {
                        'set-cookie': [
                            'SHOP_SESSION_TOKEN=abc123; path=/; domain=.mystore.com; HttpOnly',
                            'fornax_lastIdentify=abc123; path=/; domain=.mystore.com'
                        ]
                    }
                };

            responseReplyMock.header = function(name, val) {
                if (name === 'set-cookie') {
                    expect(val).to.deep.equal([
                        'SHOP_SESSION_TOKEN=abc123; path=/; HttpOnly',
                        'fornax_lastIdentify=abc123; path=/'
                    ]);
                }
            };

            server.plugins.Proxy.implementation(requestMock, {
                proxy: function(config) {
                    config.onResponse(null, responseMock, requestMock, function() {return responseReplyMock});
                    done();
                }
            });
        });

        describe('when location header is set', function() {
            it('should set location header', function(done) {
                var responseMock = {
                    statusCode: 200,
                    headers: {
                        location: 'http://mystore.com/redirect-thingy',
                        'set-cookies': []
                    }
                };

                responseReplyMock.header = function(name, val) {
                    if (name === 'location') {
                        expect(val).to.equal('http://localhost:3000/redirect-thingy');
                    }
                };

                server.plugins.Proxy.implementation(requestMock, {
                    proxy: function(config) {
                        config.onResponse(null, responseMock, requestMock, function() {return responseReplyMock});
                        done();
                    }
                });
            });

            it('should set location header with x-forwarded-proto header', function(done) {
                var responseMock = {
                    statusCode: 200,
                    headers: {
                        location: 'http://mystore.com/redirect-thingy',
                        'set-cookies': []
                    }
                };

                requestMock.headers['x-forwarded-proto'] = 'https';

                responseReplyMock.header = function(name, val) {
                    if (name === 'location') {
                        expect(val).to.equal('https://localhost:3000/redirect-thingy');
                    }
                };

                server.plugins.Proxy.implementation(requestMock, {
                    proxy: function(config) {
                        config.onResponse(null, responseMock, requestMock, function() {return responseReplyMock});
                        done();
                    }
                });
            });

            it('should make sure path ', function(done) {
                var responseMock = {
                    statusCode: 200,
                    headers: {
                        location: 'http://mystore.com/redirect-thingy',
                        'set-cookies': []
                    }
                };

                requestMock.headers['x-forwarded-proto'] = 'https';

                responseReplyMock.header = function(name, val) {
                    if (name === 'location') {
                        expect(val).to.equal('https://localhost:3000/redirect-thingy');
                    }
                };

                server.plugins.Proxy.implementation(requestMock, {
                    proxy: function(config) {
                        config.onResponse(null, responseMock, requestMock, function() {return responseReplyMock});
                        done();
                    }
                });
            });
        });
    });

    it ('should trigger boom if callback in onResponse has an error', function(done) {
        var responseMock = {};

        server.plugins.Proxy.implementation(requestMock, {
            proxy: function(config) {
                var error = config.onResponse(new Error('Ouch!'), responseMock, requestMock, function(err) {return err});

                expect(error.isBoom).to.equal(true);

                done();
            }
        });
    });
});
