/**
 * @module Contains helpers functions for working with network requests
 */

const fetch = require('node-fetch');
const fs = require('fs');

/**
 * @param {string} url
 * @param {string} outputPath
 * @returns {Promise<any>}
 */
async function fetchFile(url, outputPath) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return new Promise((resolve, reject) => {
        response.body
            .pipe(fs.createWriteStream(outputPath))
            .on('finish', resolve)
            .on('error', reject);
    });
}

module.exports = {
    fetchFile,
};
