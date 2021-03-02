/**
 * @module Contains functions for working with archives
 */

const yauzl = require('yauzl');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');

const pipeline = promisify(stream.pipeline);

/**
 * @param {object}   options
 * @param {string}   options.zipPath
 * @param {string}   [options.fileToExtract] - filename to extract only
 * @param {string[]} [options.exclude] - paths of files and directories to exclude
 * @param {object}   [options.outputNames] - new names for some files. Format: { 'oldName1': 'newName1', ...}
 * @returns {Promise<void>}
 */
async function extractZipFiles({ zipPath, fileToExtract, exclude = [], outputNames = {} }) {
    let foundMatch = false;

    const zipFile = await promisify(yauzl.open)(zipPath, { lazyEntries: true });

    await new Promise((resolve, reject) => {
        zipFile.on('entry', async (entry) => {
            try {
                foundMatch = fileToExtract === entry.fileName;
                const isNotTheSearchedFile = fileToExtract && !foundMatch;
                const isDirectory = /\/$/.test(entry.fileName);
                const isExcluded =
                    exclude.length &&
                    // startsWith used to exclude files from the specified directories
                    exclude.some((excludeItem) => entry.fileName.startsWith(excludeItem));

                if (isDirectory || isNotTheSearchedFile || isExcluded) {
                    zipFile.readEntry();
                    return;
                }

                const outputFilePath = outputNames[entry.fileName] || entry.fileName;
                const outputDir = path.parse(outputFilePath).dir;
                // Create a directory if the parent directory does not exists
                if (outputDir && !fs.existsSync(outputDir)) {
                    await fs.promises.mkdir(outputDir, { recursive: true });
                }

                const readableStream = await promisify(zipFile.openReadStream.bind(zipFile))(entry);
                const writeStream = fs.createWriteStream(outputFilePath, { flag: 'w+' });
                await pipeline(readableStream, writeStream);

                if (foundMatch) {
                    zipFile.close();
                    resolve();
                    return;
                }

                zipFile.readEntry();
            } catch (err) {
                reject(err);
            }
        });

        zipFile.readEntry();

        zipFile.once('end', () => {
            zipFile.close();

            if (!foundMatch && fileToExtract) {
                reject(new Error(`${fileToExtract} not found`));
                return;
            }

            resolve();
        });
    });
}

module.exports = {
    extractZipFiles,
};
