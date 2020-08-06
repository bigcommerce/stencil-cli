'use strict';
require('colors');
const fs = require('fs');
const Code = require('code');
const Path = require('path');
const { promisify } = require('util');
const yauzl = require('yauzl');
const request = require("request");
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;
const sinon = require('sinon');
const tmp = require('tmp');
const { downloadThemeFiles } = require('./stencil-download.utils');

describe('ThemeDownloader', function () {
    let sandbox;
    let archiveMockUrl = Path.join(process.cwd(), 'test', '_mocks', 'themes', 'valid', 'mock-theme.zip');
    let themeCallback;
    let options = {};
    let fsWriteSub;
    let zipOpenSpy;

    lab.beforeEach(() => {
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
    });

    lab.afterEach(() => {
        sandbox.restore();
    });

    describe("Verify till Zip opens", () => {
        lab.beforeEach(() => {
            zipOpenSpy = sandbox.spy(yauzl, 'open');
            zipOpenSpy(archiveMockUrl, {lazyEntries: true}, themeCallback);
        });

        lab.afterEach(() => {
            sandbox.restore();
        });

        it('should verify that the tmp.file() is called', async () => {
            const tmpSpy = sandbox.spy(tmp);

            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.lastCall.callback();
            await promise;

            expect(tmpSpy.file.called).to.be.true();
        });

        it('should return a callback error', async () => {
            const throwsSpy = sandbox.spy(request);
            downloadThemeFiles(null, themeCallback);

            try {
                throwsSpy();
            } catch (e) {
            }

            sandbox.assert.threw(throwsSpy);
        });

        it('should verify request is called with downloadUrl', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.lastCall.callback();
            await promise;

            sandbox.assert.calledOnce(request.Request);
        });

        it('should verify createWriteStream is also called within the request', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.lastCall.callback();
            await promise;

            sandbox.assert.calledOnce(fs.createWriteStream);
        });

        it('should verify that the yauzl zip module is called', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.lastCall.callback();
            await promise;

            expect(yauzl.open.called).to.be.true();
        });

        it('should call the zip open callback with zipFile', async () => {
            const zip = await promisify(zipOpenSpy)(archiveMockUrl, {lazyEntries: true});

            expect(zip.fileSize).to.be.greaterThan(100);
        });
    });

    describe("Verify After zip opens", () => {
        lab.afterEach(() => {
            options = {downloadUrl: archiveMockUrl};
            sandbox.restore();
        });

        it('should write the two files inside the zip archive', async () => {
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub.calledTwice).to.be.true();
        });

        it('should exclude config.json from files to write', async () => {
            options.exclude = ['config.json'];
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub.calledOnce).to.be.true();
        });

        it('should write config.json only', async () => {
            options.file = 'config.json';
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub.calledOnce).to.be.true();
        });
    });
});
