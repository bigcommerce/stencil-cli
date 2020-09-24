/**
 * @module Contains functions for working with archives
 */

const yauzl = require('yauzl');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const { readFromStream } = require('./utils/asyncUtils');

/**
 * @param {object}   options
 * @param {string}   options.zipPath
 * @param {string}   [options.fileToExtract] - filename to download only
 * @param {string[]} [options.exclude] - paths of files and directories to exclude
 * @param {object}   [options.outputNames] - new names for some files. Format: { 'oldName1': 'newName1', ...}
 * @returns {Promise<void>}
 */
async function extractZipFiles({ zipPath, fileToExtract, exclude, outputNames = {}}) {
    let foundMatch = false;

    const zipFile = await promisify(yauzl.open)(zipPath, { lazyEntries: true });

    await new Promise((resolve, reject) => {
        zipFile.on('entry', async entry => {
            try {
                const readableStream = await promisify(zipFile.openReadStream.bind(zipFile))(entry);

                if (fileToExtract) {
                    if (fileToExtract !== entry.fileName) {
                        return zipFile.readEntry();
                    }
                    foundMatch = true;
                } else if (exclude && exclude.length) {
                    // Do not process any file or directory within the exclude option
                    for (const excludeItem of exclude) {
                        if (entry.fileName.startsWith(excludeItem)) {
                            return zipFile.readEntry();
                        }
                    }
                }

                // If file is a directory, then move to next
                if (/\/$/.test(entry.fileName)) {
                    return zipFile.readEntry();
                }

                // Create a directory if the parent directory does not exists
                const parsedPath = path.parse(entry.fileName);

                if (parsedPath.dir && !fs.existsSync(parsedPath.dir)) {
                    fs.mkdirSync(parsedPath.dir, { recursive: true });
                }

                let fileData = await readFromStream(readableStream);
                if (entry.fileName.endsWith('.json')) {
                    // Make sure that the JSON file if valid
                    fileData = JSON.stringify(JSON.parse(fileData), null, 2);
                }

                const outputFileName = outputNames[entry.fileName] || entry.fileName;
                await promisify(fs.writeFile)(outputFileName, fileData, { flag: 'w+' });

                // Close read if the requested file is found
                if (fileToExtract) {
                    zipFile.close();
                    return resolve();
                }

                zipFile.readEntry();
            } catch (err) {
                return reject(err);
            }
        });

        zipFile.readEntry();

        zipFile.once('end', function () {
            zipFile.close();

            if (!foundMatch && fileToExtract) {
                return reject(new Error(`${fileToExtract} not found`));
            }

            resolve();
        });
    });
}


module.exports = {
    extractZipFiles,
};

