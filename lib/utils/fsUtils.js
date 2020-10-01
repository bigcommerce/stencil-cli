/**
 * @module Contains helpers functions for working with file system
 */

const fs = require('fs');
const jsonLint = require('../json-lint');

/**
 * @param {string} filePath
 * @returns {Object} - parsed JSON content of the file
 */
function parseJsonFile(filePath) {
    const contentStr = fs.readFileSync(filePath, { encoding: 'utf-8' });
    // We use jsonLint.parse instead of JSON.parse because jsonLint throws errors with better explanations what is wrong
    return jsonLint.parse(contentStr, filePath);
}

module.exports = {
    parseJsonFile,
};
