const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const tmp = require('tmp-promise');

const MockWritableStream = require('../test/_mocks/MockWritableStream');
const { extractZipFiles } = require('./archiveManager');

describe('archiveManager', () => {
    describe('extractZipFiles', () => {
        // We run tests for a real archive containing 3 files:
        // - config.json
        // - schema.json
        // - meta/mobile_light.jpg
        const zipPath = path.join(
            process.cwd(),
            'test',
            '_mocks',
            'themes',
            'valid',
            'mock-theme.zip',
        );

        const stubFsWriteStream = () => {
            return jest
                .spyOn(fs, 'createWriteStream')
                .mockImplementation(() => new MockWritableStream());
        };

        afterEach(() => {
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it('should call yauzl.open with the passed zipPath', async () => {
            const yauzlOpenSpy = jest.spyOn(yauzl, 'open');
            stubFsWriteStream();

            await extractZipFiles({ zipPath });

            expect(yauzlOpenSpy).toHaveBeenCalledTimes(1);
        });

        it('should save all the files from the zip archive taking into account options.outputNames', async () => {
            const fsCreateWriteStreamStub = stubFsWriteStream();
            const newConfigName = 'new-path/config2.json';
            const outputNames = { 'config.json': newConfigName };

            await extractZipFiles({ zipPath, outputNames });

            expect(fsCreateWriteStreamStub).toHaveBeenCalledTimes(3);
            expect(fsCreateWriteStreamStub).toHaveBeenCalledWith(
                'schema.json',
                expect.objectContaining({ flag: 'w+' }),
            );
            expect(fsCreateWriteStreamStub).toHaveBeenCalledWith(
                newConfigName,
                expect.objectContaining({ flag: 'w+' }),
            );
        });

        it('should not save files specified in options.exclude', async () => {
            const fsCreateWriteStreamStub = stubFsWriteStream();
            const exclude = ['config.json'];

            await extractZipFiles({ zipPath, exclude });

            expect(fsCreateWriteStreamStub).not.toHaveBeenCalledWith(
                exclude[0],
                expect.objectContaining({ flag: 'w+' }),
            );
        });

        it('should save the file specified in options.fileToExtract only', async () => {
            const fsCreateWriteStreamStub = stubFsWriteStream();
            const fileToExtract = 'config.json';

            await extractZipFiles({ zipPath, fileToExtract });

            expect(fsCreateWriteStreamStub).toHaveBeenCalledTimes(1);
            expect(fsCreateWriteStreamStub).toHaveBeenCalledWith(
                fileToExtract,
                expect.objectContaining({ flag: 'w+' }),
            );
        });

        it('should throw an error when the file with name options.fileToExtract was not found', async () => {
            const fsCreateWriteStreamStub = stubFsWriteStream();
            const fileToExtract = 'I dont exist.txt';

            await expect(extractZipFiles({ zipPath, fileToExtract })).rejects.toThrow(/not found/);

            expect(fsCreateWriteStreamStub).toHaveBeenCalledTimes(0);
        });

        it('should pass on errors happening during files extraction', async () => {
            const error = new Error('something went wrong');
            jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
                throw error;
            });

            await expect(extractZipFiles({ zipPath })).rejects.toThrow(error);
        });

        it('should extract binary files properly', async () => {
            const { path: tempThemePath, cleanup } = await tmp.dir({ unsafeCleanup: true });
            const expectedImage = await fs.promises.readFile(
                './test/_mocks/themes/valid/meta/mobile_light.jpg',
            );
            const fsCreateWriteStreamSpy = jest.spyOn(fs, 'createWriteStream');
            const fileToExtract = 'meta/mobile_light.jpg';
            const outputFilePath = path.join(tempThemePath, fileToExtract);
            const outputNames = {
                [fileToExtract]: outputFilePath,
            };

            await extractZipFiles({ zipPath, fileToExtract, outputNames });

            const extractedImage = await fs.promises.readFile(outputFilePath);

            expect(fsCreateWriteStreamSpy).toHaveBeenCalledTimes(1);
            expect(fsCreateWriteStreamSpy).toHaveBeenCalledWith(
                outputFilePath,
                expect.objectContaining({ flag: 'w+' }),
            );

            // eslint-disable-next-line jest/prefer-to-have-length
            expect(extractedImage.length).toStrictEqual(expectedImage.length);
            expect(Buffer.compare(extractedImage, expectedImage)).toBe(0);

            await cleanup();
        });
    });
});
