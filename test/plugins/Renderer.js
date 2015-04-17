var Assembler = require('../../server/lib/assembler'),
    Boom = require('boom'),
    Code = require('code'),
    Hapi = require('hapi'),
    FetchData = require('../../server/lib/fetchData'),
    Lab = require('lab'),
    Paper = require('stencil-paper'),
    Sinon = require('sinon'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it,
    describe = lab.describe,
    internals = {
        paths: {
            pluginsPath: './../../server/plugins'
        }
    };

describe('Renderer', function () {
    var server = new Hapi.Server(),
        replyResponseMock = {
            code: function() {},
            header: function() {},
            type: function() {}
        },
        requestMock = {
            app: {
                storeUrl: 'https://mystore.com'
            },
            headers: {
                host: 'localhost:3000'
            }
        },
        replyMock = function() {
            return replyResponseMock;
        },
        replySpy,
        replyRedirectSpy,
        replyResponseCodeSpy,
        replyResponseHeaderSpy,
        replyResponseTypeSpy;

    replyMock.redirect = function() {
        return replyResponseMock;
    };

    replySpy = Sinon.spy(replyMock);
    replyRedirectSpy = Sinon.spy(replyMock, 'redirect');
    replyResponseCodeSpy = Sinon.spy(replyResponseMock, 'code');
    replyResponseHeaderSpy = Sinon.spy(replyResponseMock, 'header');
    replyResponseTypeSpy = Sinon.spy(replyResponseMock, 'type');

    server.connection({port: 3000});

    lab.before(function(done) {
        server.register([{
            register: require(internals.paths.pluginsPath + '/Renderer')
        }], function (err) {
            expect(err).to.equal(undefined);
            done();
        });
    });

    it('should reply with Boom error if fetchData returns error', {only: true}, function(done) {
        var error = new Error('No good!'),
            fetchDataStub = Sinon.stub(FetchData, 'fetch');

        fetchDataStub.callsArgWith(2, error);
        server.plugins.Renderer.implementation(requestMock, replySpy);

        expect(replySpy.calledWith(Boom.wrap(error))).to.equal(true);

        fetchDataStub.restore();

        done();
    });

    describe('with redirects', function() {
        it('should set correct redirect headers if fetchData response headers has location set', function(done) {
            var fetchDataStub = Sinon.stub(FetchData, 'fetch');

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 301,
                headers: {
                    location: 'http://localhost:3000/redirect-me'
                }
            });

            server.plugins.Renderer.implementation(requestMock, replyMock);

            expect(replyResponseCodeSpy.calledWith(301)).to.equal(true);
            expect(replyRedirectSpy.calledWith('http://localhost:3000/redirect-me')).to.equal(true);

            fetchDataStub.restore();
            done();
        });

        it('should set cookies if present in the header', function(done) {
            var cookies = ['hey', 'there'],
                fetchDataStub = Sinon.stub(FetchData, 'fetch');

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 301,
                headers: {
                    location: 'http://localhost:3000/redirect-me',
                    'set-cookie': cookies
                }
            });

            server.plugins.Renderer.implementation(requestMock, replyMock);

            expect(replyResponseHeaderSpy.calledWith('set-cookie', cookies)).to.equal(true);

            fetchDataStub.restore();
            done();
        });
    });

    describe('with rawData', function() {
        it('should reply with rawData if returned from fetchData', function(done) {
            var contentBuffer = new Buffer('Hi There!'),
                fetchDataStub = Sinon.stub(FetchData, 'fetch');

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain'
                },
                rawData: contentBuffer
            });

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replyResponseCodeSpy.calledWith(200)).to.equal(true);
            expect(replyResponseTypeSpy.calledWith('text/plain')).to.equal(true);
            expect(replySpy.calledWith(contentBuffer)).to.equal(true);

            fetchDataStub.restore();
            done();
        });

        it('should set cookies if present in the header', function(done) {
            var cookies = ['hey', 'there'],
                contentBuffer = new Buffer('Hi There!'),
                fetchDataStub = Sinon.stub(FetchData, 'fetch');

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'set-cookie': cookies
                },
                rawData: contentBuffer
            });

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replyResponseHeaderSpy.calledWith('set-cookie', cookies)).to.equal(true);

            fetchDataStub.restore();
            done();
        });
    });

    describe('with regular request', function() {
        it('should reply with Boom error if Assembler returns an error', function(done) {
            var error = new Error('No Good!'),
                templateFile = 'test.html',
                fetchDataStub = Sinon.stub(FetchData, 'fetch'),
                assemblerStub = Sinon.stub(Assembler, 'assemble');

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain'
                },
                template_file: templateFile
            });

            assemblerStub.callsArgWith(1, error);

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replySpy.calledWith(Boom.wrap(error))).to.equal(true);

            fetchDataStub.restore();
            assemblerStub.restore();
            done();
        });

        it('should reply with Boom error if the second FetchData returns an error', function(done) {
            var error = new Error('No Good!'),
                templateFile = 'test.html',
                fetchDataStub = Sinon.stub(FetchData, 'fetch'),
                assemblerStub = Sinon.stub(Assembler, 'assemble'),
                paperStub = Sinon.stub(Paper, 'compile');

            fetchDataStub.onFirstCall().callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain'
                },
                template_file: templateFile,
                context: {
                    settings: {
                        base_url: 'http://mystore.com',
                        secure_base_url: 'https://mystore.com'
                    }
                }
            });

            paperStub.returns('');

            fetchDataStub.onSecondCall().callsArgWith(2, error);

            assemblerStub.callsArgWith(1, null, {
                config: {},
                templates: {}
            });

            requestMock.query = {
                debug: false
            };

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replySpy.calledWith(Boom.wrap(error))).to.equal(true);

            fetchDataStub.restore();
            assemblerStub.restore();
            paperStub.restore();

            done();
        });

        it('should reply with properly decorated content without debug bar', function(done) {
            var context = {
                    foo: 'bar',
                    settings: {
                        base_url: 'http://mystore.com',
                        secure_base_url: 'https://mystore.com'
                    }
                },
                templateFile = 'test.html',
                renderedContent = '<body>' +
                    '<a href="' + context.settings.base_url + '/foo">Base Url</a>' +
                    '<a href="' + context.settings.secure_base_url + '/secure-foo">Secure Base Url</a>' +
                    '</body>',
                decoratedContent = '<body>' +
                    '<a href="/foo">Base Url</a>' +
                    '<a href="/secure-foo">Secure Base Url</a>' +
                    '</body>',
                templates = {
                    foo: 'bar.html'
                },
                fetchDataStub = Sinon.stub(FetchData, 'fetch'),
                assemblerStub = Sinon.stub(Assembler, 'assemble'),
                paperStub = Sinon.stub(Paper, 'compile');

            requestMock.query = {
                debug: false
            };

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain'
                },
                template_file: templateFile,
                context: context
            });

            assemblerStub.callsArgWith(1, null, {
                config: {},
                templates: templates
            });

            paperStub.returns(renderedContent);

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replyResponseCodeSpy.calledWith(200)).to.equal(true);
            expect(paperStub.calledWith(templateFile, templates, context));
            expect(replySpy.calledWith(decoratedContent)).to.equal(true);

            fetchDataStub.restore();
            assemblerStub.restore();
            paperStub.restore();

            delete requestMock.query;

            done();
        });

        it('should reply with debug bar if debug is set to "bar"', function(done) {
            var context = {
                    foo: 'bar',
                    settings: {
                        base_url: 'http://mystore.com',
                        secure_base_url: 'https://mystore.com'
                    }
                },
                templateFile = 'test.html',
                renderedContent = '<body></body>',
                decoratedContent =
                    '<body><pre><p><b>Context:</b></p>' + JSON.stringify(context, null, 2) + '</pre>\n</body>',
                templates = {
                    foo: 'bar.html'
                },
                fetchDataStub = Sinon.stub(FetchData, 'fetch'),
                assemblerStub = Sinon.stub(Assembler, 'assemble'),
                paperStub = Sinon.stub(Paper, 'compile');

            requestMock.query = {
                debug: 'bar'
            };

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain'
                },
                template_file: templateFile,
                context: context
            });

            assemblerStub.callsArgWith(1, null, {
                config: {},
                templates: templates
            });

            paperStub.returns(renderedContent);

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replyResponseCodeSpy.calledWith(200)).to.equal(true);
            expect(paperStub.calledWith(templateFile, templates, context));
            expect(replySpy.calledWith(decoratedContent)).to.equal(true);

            fetchDataStub.restore();
            assemblerStub.restore();
            paperStub.restore();

            delete requestMock.query;

            done();
        });

        it('should set cookies if set-cookies is in the headers', function(done) {
            var context = {
                    foo: 'bar',
                    settings: {
                        base_url: 'http://mystore.com',
                        secure_base_url: 'https://mystore.com'
                    }
                },
                cookies = ['hey', 'there'],
                templateFile = 'test.html',
                fetchDataStub = Sinon.stub(FetchData, 'fetch'),
                assemblerStub = Sinon.stub(Assembler, 'assemble'),
                paperStub = Sinon.stub(Paper, 'compile');

            requestMock.query = {
                debug: 'bar'
            };

            fetchDataStub.callsArgWith(2, null, {
                statusCode: 200,
                headers: {
                    'content-type': 'text/plain',
                    'set-cookie': cookies
                },
                template_file: templateFile,
                context: context
            });

            assemblerStub.callsArgWith(1, null, {
                config: {},
                templates: {}
            });

            paperStub.returns('');

            server.plugins.Renderer.implementation(requestMock, replySpy);

            expect(replyResponseHeaderSpy.calledWith('set-cookie', cookies)).to.equal(true);

            fetchDataStub.restore();
            assemblerStub.restore();
            paperStub.restore();

            delete requestMock.query;

            done();
        });
    });
});
