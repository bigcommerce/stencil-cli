const fs = require('fs');
const Path = require('path');
const yauzl = require('yauzl');

const { extractZipFiles } = require('./archiveManager');

describe('archiveManager', () => {
    describe('extractZipFiles', () => {
        // We run tests for a real archive containing 2 files:
        // - config.json
        // - schema.json
        let zipPath = Path.join(process.cwd(), 'test', '_mocks', 'themes', 'valid', 'mock-theme.zip');
        let fsWriteSub;
        let yauzlOpenSpy;

        beforeEach(() => {
            jest.spyOn(console, 'log').mockImplementation(jest.fn());

            fsWriteSub = jest.spyOn(fs, 'writeFile').mockImplementation((name, config, options, callback) => {
                callback(false);
            });
        });

        afterEach(() => {
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        beforeEach(() => {
            yauzlOpenSpy = jest.spyOn(yauzl, 'open');
        });

        it('should call yauzl.open with the passed zipPath', async () => {
            await extractZipFiles({ zipPath });

            expect(yauzlOpenSpy).toHaveBeenCalledTimes(1);
        });

        it('should save all the files from the zip archive taking into account options.outputNames', async () => {
            const newConfigName = 'config2.json';
            const outputNames = { 'config.json': newConfigName };
            await extractZipFiles({ zipPath, outputNames });

            expect(fsWriteSub).toHaveBeenCalledTimes(2);
            expect(fsWriteSub).toHaveBeenCalledWith(
                'schema.json', expect.anything(), expect.objectContaining({ flag: 'w+' }), expect.any(Function),
            );
            expect(fsWriteSub).toHaveBeenCalledWith(
                newConfigName, expect.anything(), expect.objectContaining({ flag: 'w+' }), expect.any(Function),
            );
        });

        it('should not save files specified in options.exclude', async () => {
            const exclude = ['config.json'];
            await extractZipFiles({ zipPath, exclude });

            expect(fsWriteSub).toHaveBeenCalledTimes(1);
            expect(fsWriteSub).toHaveBeenCalledWith(
                'schema.json', expect.anything(), expect.objectContaining({ flag: 'w+' }), expect.any(Function),
            );
        });

        it('should save the file specified in options.fileToExtract only', async () => {
            const fileToExtract = 'config.json';
            await extractZipFiles({ zipPath, fileToExtract });

            expect(fsWriteSub).toHaveBeenCalledTimes(1);
            expect(fsWriteSub).toHaveBeenCalledWith(
                fileToExtract, expect.anything(), expect.objectContaining({ flag: 'w+' }), expect.any(Function),
            );
        });

        it('should throw an error when the file with name options.fileToExtract was not found', async () => {
            const fileToExtract = 'I dont exist.txt';

            await expect(
                extractZipFiles({ zipPath, fileToExtract }),
            ).rejects.toThrow(/not found/);

            expect(fsWriteSub).toHaveBeenCalledTimes(0);
        });
    });
});
