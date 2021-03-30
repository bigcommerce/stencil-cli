/**
 * @module Contains helpers functions for working with file system
 */

const fs = require('fs');
const recursiveReadDir = require('recursive-readdir');
const jsonLint = require('../json-lint');

/**
 * @param {string} filePath
 * @returns {Promise<Object>} - parsed JSON content of the file
 */
async function parseJsonFile(filePath) {
    const contentStr = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    // We use jsonLint.parse instead of JSON.parse because jsonLint throws errors with better explanations what is wrong
    return jsonLint.parse(contentStr, filePath);
}

module.exports = {
    ...fs,
    parseJsonFile,
    recursiveReadDir,
};
