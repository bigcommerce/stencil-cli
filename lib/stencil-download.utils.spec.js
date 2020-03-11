'use strict';
require('colors');
const fs = require('fs');
const Code = require('code');
const Path = require('path');
const yauzl = require('yauzl');
const request = require("request");
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;
const sinon = require('sinon');
const tmp = require('tmp');
const stencilDownload = require('./stencil-download.utils');


describe('ThemeDownloader', function () {
    let sandbox;
    let archiveMockUrl = Path.join(process.cwd(), 'test', '_mocks', 'themes', 'valid', 'mock-theme.zip');
    let themeCallback;
    let options = {};
    let fsWriteSub;
    let zipOpenSpy;

    lab.beforeEach(function (done) {
        sandbox = sinon.createSandbox();
        options = {downloadUrl: archiveMockUrl};

        themeCallback = () => {};

        sandbox.stub(request, 'Request').callsFake(requestStub);
        fsWriteSub =  sandbox.stub(fs, 'writeFile').callsFake(writeFileStub);

        function writeFileStub(name, config, options, callback) {
            callback(false);
        }

        function requestStub(option) {
            this.pipe = () => {
                return this;
            };
            this.on = (event, optionCallback) => {
                if (event === 'finish') {
                    optionCallback(option.uri);
                }
                return this;
            };
        }

        sandbox.stub(fs, 'createWriteStream').callsFake(tempPath => {
            fs.writeFileSync(tempPath, fs.readFileSync(options.downloadUrl));
        });

        done();
    });

    lab.afterEach(done => {
        sandbox.restore();
        done();
    });

    describe("Verify till Zip opens", () => {

        lab.beforeEach(done => {
            zipOpenSpy = sandbox.spy(yauzl, 'open');
            zipOpenSpy(archiveMockUrl, {lazyEntries: true}, themeCallback);
            done();
        });

        lab.afterEach(done => {
            sandbox.restore();
            done();
        });

        it('should verify that the tmp.file() is called', done => {
            const tmpSpy = sandbox.spy(tmp);
            themeCallback = () => {
                expect(tmpSpy.file.called).to.be.true();
                done();
            };
            stencilDownload.downloadThemeFiles(options, themeCallback);
            zipOpenSpy.lastCall.callback();
        });

        it('should return a callback error', done => {
            const throwsSpy = sandbox.spy(request);
            stencilDownload.downloadThemeFiles(null, themeCallback);

            try {
                throwsSpy();
            } catch (e) {
            }

            sandbox.assert.threw(throwsSpy);
            done();
        });

        it('should verify request is called with downloadUrl', done => {
            themeCallback = () => {
                sandbox.assert.calledOnce(request.Request);
                done();

            };
            stencilDownload.downloadThemeFiles(options, themeCallback);
            zipOpenSpy.lastCall.callback();

        });

        it('should verify createWriteStream is also called within the request', done => {
            themeCallback = () => {
                sandbox.assert.calledOnce(fs.createWriteStream);
                done();

            };
            stencilDownload.downloadThemeFiles(options, themeCallback);

            zipOpenSpy.lastCall.callback();
        });

        it('should verify that the yauzl zip module is called', done => {

            themeCallback = () => {
                expect(yauzl.open.called).to.be.true();
                done();
            };

            stencilDownload.downloadThemeFiles(options, themeCallback);
            zipOpenSpy.lastCall.callback();
        });

        it('should call the zip open callback with zipFile', done => {
            const callback = (err, zip) => {
                expect(zip.fileSize).to.be.greaterThan(100);
                done();
            };
            zipOpenSpy(archiveMockUrl, {lazyEntries: true}, callback);
        });
    });


    describe("Verify After zip opens", () => {

        lab.afterEach(done => {
            options = {downloadUrl: archiveMockUrl};
            sandbox.restore();
            done();
        });

        it('should write the two files inside the zip archive', done => {
            themeCallback = () => {
                expect(fsWriteSub.calledTwice).to.be.true();

                done();
            };
            stencilDownload.downloadThemeFiles(options, themeCallback);
        });

        it('should exclude config.json from files to write', done => {
            options.exclude = ['config.json'];
            themeCallback = () => {
                expect(fsWriteSub.calledOnce).to.be.true();
                done();
            };
            stencilDownload.downloadThemeFiles(options, themeCallback);
        });

        it('should write config.json only', done => {
            options.file = 'config.json';
            themeCallback = () => {
                expect(fsWriteSub.calledOnce).to.be.true();
                done();
            };
            stencilDownload.downloadThemeFiles(options, themeCallback);
        });

    });
});
