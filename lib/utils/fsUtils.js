/**
 * @module Contains helpers functions for working with file system
 */

const fs = require('fs');
const recursiveReadDir = require('recursive-readdir');
const { parse } = require('../parse-json');

/**
 * @param {string} filePath
 * @returns {Promise<Object>} - parsed JSON content of the file
 */
async function parseJsonFile(filePath) {
    const contentStr = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    // We use parse-json instead of JSON.parse because it throws errors with better explanations what is wrong
    return parse(contentStr, filePath);
}

module.exports = {
    ...fs,
    parseJsonFile,
    recursiveReadDir,
};
