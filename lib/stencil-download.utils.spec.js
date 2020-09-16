'use strict';

require('colors');
const fs = require('fs');
const Path = require('path');
const { promisify } = require('util');
const yauzl = require('yauzl');
const fetch = require('node-fetch');
const tmp = require('tmp');

const { downloadThemeFiles } = require('./stencil-download.utils');

jest.mock('node-fetch');

describe('ThemeDownloader', function () {
    let archiveMockUrl = Path.join(process.cwd(), 'test', '_mocks', 'themes', 'valid', 'mock-theme.zip');
    let themeCallback;
    let options = {};
    let fsWriteSub;
    let fsCreateWriteStreamStub;
    let zipOpenSpy;

    beforeEach(() => {
        options = { downloadUrl: archiveMockUrl };
        themeCallback = () => {};

        jest.spyOn(console, 'log').mockImplementation(jest.fn());

        fetch.mockImplementation(async() => ({
            ok: true,
            body: {
                pipe: function responseBodyStreamStub () {
                    return {
                        pipe: () => {
                            return this;
                        },
                        on: (event, optionCallback) => {
                            if (event === 'finish') {
                                optionCallback();
                            }
                            return this;
                        },
                    };
                },
            },
        }));

        fsWriteSub = jest.spyOn(fs, 'writeFile').mockImplementation(writeFileStub);

        function writeFileStub(name, config, options, callback) {
            callback(false);
        }

        fsCreateWriteStreamStub = jest.spyOn(fs, 'createWriteStream').mockImplementation(tempPath => {
            fs.writeFileSync(tempPath, fs.readFileSync(options.downloadUrl));
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    describe("Verify till Zip opens", () => {
        beforeEach(() => {
            zipOpenSpy = jest.spyOn(yauzl, 'open');
            zipOpenSpy(archiveMockUrl, {lazyEntries: true}, themeCallback);
        });

        it('should verify that the tmp.file() is called', async () => {
            const tmpFileSpy = jest.spyOn(tmp, 'file');

            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.mock.calls[0][2]();
            await promise;

            expect(tmpFileSpy).toHaveBeenCalledTimes(1);
        });

        it('should return a callback error', async () => {
            await expect(
                promisify(downloadThemeFiles)(null),
            ).rejects.toThrow('Cannot read property \'downloadUrl\' of null');
        });

        it('should verify request is called with downloadUrl', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.mock.calls[0][2]();
            await promise;

            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should verify createWriteStream is also called within the request', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.mock.calls[0][2]();
            await promise;

            expect(fsCreateWriteStreamStub).toHaveBeenCalledTimes(1);
        });

        it('should verify that the yauzl zip module is called', async () => {
            const promise = promisify(downloadThemeFiles)(options);
            zipOpenSpy.mock.calls[0][2]();
            await promise;

            expect(yauzl.open).toHaveBeenCalledTimes(2);
        });

        it('should call the zip open callback with zipFile', async () => {
            const zip = await promisify(zipOpenSpy)(archiveMockUrl, {lazyEntries: true});

            expect(zip.fileSize).toBeGreaterThan(100);
        });
    });

    describe("Verify After zip opens", () => {
        it('should write the two files inside the zip archive', async () => {
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub).toHaveBeenCalledTimes(2);
        });

        it('should exclude config.json from files to write', async () => {
            options.exclude = ['config.json'];
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub).toHaveBeenCalledTimes(1);
        });

        it('should write config.json only', async () => {
            options.file = 'config.json';
            await promisify(downloadThemeFiles)(options);

            expect(fsWriteSub).toHaveBeenCalledTimes(1);
        });
    });
});
