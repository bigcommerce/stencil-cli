var Async = require('async'),
    Code = require('code'),
    FetchData = require('../../server/lib/fetchData'),
    Hoek = require('hoek'),
    Lab = require('lab'),
    Sinon = require('sinon'),
    Wreck = require('wreck'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it,
    describe = lab.describe;

describe('FetchData', function() {
    var requestMock = {
            app: {
                staplerUrl: 'https://stapler.bigcommerce.com',
                storeUrl: 'https://mystore.com'
            },
            headers: {
                host: 'localhost:3000'
            },
            url: '/my-product'
        },
        wreckRequestStub,
        wreckReadStub,
        httpOpts;

    lab.beforeEach(function(done) {
        Sinon.stub(Hoek, 'nextTick').returnsArg(0);
        wreckRequestStub = Sinon.stub(Wreck, 'request');
        wreckReadStub = Sinon.stub(Wreck, 'read');

        httpOpts  = {
            rejectUnauthorized: false,
            headers: {
                'stencil-version': '2.0',
                'stencil-config': JSON.stringify({}),
                'stencil-options': JSON.stringify({get_data_only: true}),
                'stencil-store-url': requestMock.app.storeUrl
            }
        };

        done();
    });

    lab.afterEach(function(done) {
        wreckRequestStub.restore();
        wreckReadStub.restore();
        Hoek.nextTick.restore();

        done();
    });

    describe('Wreck Request', function() {
        describe('Arguments', function() {
            it('should set correct args if blank object passed for params', function(done) {
                FetchData.fetch(requestMock, {}, Sinon.stub());

                expect(wreckRequestStub.calledWith('GET', 'https://stapler.bigcommerce.com/my-product', httpOpts)).to.equal(true);
                done();
            });

            it('should set correct args if callback passed in as second argument', function(done) {
                FetchData.fetch(requestMock, Sinon.stub());

                expect(wreckRequestStub.calledWith('GET', 'https://stapler.bigcommerce.com/my-product', httpOpts)).to.equal(true);
                done();
            });

            it('should merge options and config in params argument', function(done) {
                var params = {
                        config: {
                            foo: 'bar'
                        },
                        options: {
                            my: 'thing'
                        }
                    };

                httpOpts.headers['stencil-config'] = JSON.stringify(params.config);
                httpOpts.headers['stencil-options'] = JSON.stringify(Hoek.applyToDefaults({get_data_only: true}, params.options));

                FetchData.fetch(requestMock, params, Sinon.stub());

                expect(wreckRequestStub.calledWith('GET', 'https://stapler.bigcommerce.com/my-product', httpOpts)).to.equal(true);
                done();
            });

            it('should set correct cookies if in header', function(done) {
                var cookie = {my: 'cookie'};

                requestMock.headers.cookie = cookie;
                httpOpts.headers.cookie = cookie;

                FetchData.fetch(requestMock, Sinon.stub());

                expect(wreckRequestStub.calledWith('GET', 'https://stapler.bigcommerce.com/my-product', httpOpts)).to.equal(true);

                done();
            });
        });

        describe('Callback', function() {
            it('should call callback first argument if there is an error from the request', function(done) {
                var callbackStub = Sinon.stub(),
                    error = 'Rut Roh!';

                wreckRequestStub.callsArgWith(3, error);

                FetchData.fetch(requestMock, callbackStub);

                expect(callbackStub.calledWithExactly(error)).to.equal(true);
                done();
            });

            it('should call callback first argument if there is a 30x statusCode but no location header', function(done) {
                var callbackStub = Sinon.stub(),
                    response = {
                        statusCode: 301,
                        headers: {}
                    };

                wreckRequestStub.callsArgWith(3, null, response);

                FetchData.fetch(requestMock, callbackStub);

                expect(callbackStub.args[0][0]).to.not.equal(null);

                done();
            });

            describe('With Different Redirect StatusCodes', function() {
                Async.map([301, 302, 303], function(statusCode, callback) {
                    it('should set location header if statusCode is ' + statusCode + ' and immediately call callback.', function(done) {
                        var callbackStub = Sinon.stub(),
                        response = {
                            statusCode: statusCode,
                            headers: {
                                location: 'https://mystore.com/redirect-me'
                            }
                        };

                        wreckRequestStub.callsArgWith(3, null, response);

                        FetchData.fetch(requestMock, callbackStub);

                        expect(callbackStub.calledWithExactly(null, {
                            statusCode: statusCode,
                            headers: {
                                location: 'http://localhost:3000/redirect-me'
                            }
                        })).to.equal(true);

                        done();
                        callback();
                    });
                });
            });


            describe('Wreck Read', function() {
                describe('Arguments', function() {
                    it('should rewrite cookies if set-cookies in response header', function(done) {
                        var callbackStub = Sinon.stub(),
                            response = {
                                statusCode: 200,
                                headers: {
                                    'set-cookie': [
                                        'SHOP_SESSION_TOKEN=abc123; path=/; domain=.mystore.com; HttpOnly',
                                        'fornax_lastIdentify=abc123; path=/; domain=.mystore.com'
                                    ]
                                }
                            };

                        wreckRequestStub.callsArgWith(3, null, response);

                        FetchData.fetch(requestMock, callbackStub);

                        expect(wreckReadStub.calledWith({
                            statusCode: 200,
                            headers: {
                                'set-cookie': [
                                    'SHOP_SESSION_TOKEN=abc123; path=/; HttpOnly',
                                    'fornax_lastIdentify=abc123; path=/'
                                ]
                            }
                        }, {json: true})).to.equal(true);

                        done();
                    });

                    describe('Callback', function() {
                        it('should call callback first argument if there is an error from the request', function(done) {
                            var callbackStub = Sinon.stub(),
                                response = {
                                    statusCode: 200,
                                    headers: {}
                                },
                                error = 'Rut Roh!';

                            wreckRequestStub.callsArgWith(3, null, response);
                            wreckReadStub.callsArgWith(2, error);

                            FetchData.fetch(requestMock, callbackStub);

                            expect(callbackStub.calledWithExactly(error)).to.equal(true);
                            done();
                        });

                        it('should call callback with rawData if template_file not set', function(done) {
                            var callbackStub = Sinon.stub(),
                                response = {
                                    statusCode: 200,
                                    headers: {}
                                },
                                data = new Buffer('I\'m Raw Baby!'),
                                ret = {
                                    rawData: data,
                                    headers: {},
                                    statusCode: 200
                                };

                            wreckRequestStub.callsArgWith(3, null, response);
                            wreckReadStub.callsArgWith(2, null, data);

                            FetchData.fetch(requestMock, callbackStub);

                            expect(callbackStub.calledWithExactly(null, ret)).to.equal(true);
                            done();
                        });

                        it('should call callback with context if template_file is set', function(done) {
                            var callbackStub = Sinon.stub(),
                                response = {
                                    statusCode: 200,
                                    headers: {}
                                },
                                data = {
                                    template_file: 'foo.html',
                                    context: {foo: 'bar'}
                                },
                                ret = {
                                    template_file: data.template_file,
                                    context: data.context,
                                    headers: {},
                                    statusCode: 200
                                };

                            wreckRequestStub.callsArgWith(3, null, response);
                            wreckReadStub.callsArgWith(2, null, data);

                            FetchData.fetch(requestMock, callbackStub);

                            expect(callbackStub.calledWithExactly(null, ret)).to.equal(true);
                            done();
                        });
                    });
                });
            });
        });
    });
});
