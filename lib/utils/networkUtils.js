/**
 * @module Contains helpers functions for working with network requests
 */

const fetch = require('node-fetch');
const fs = require('fs');
const axios = require('axios');

/**
 * @param {object} options
 * @returns {Promise<object>}
 */
async function sendApiRequest(options) {
    return axios(options);
}

/**
 * @param {string} url
 * @param {string} outputPath
 * @returns {Promise<any>}
 */
async function fetchFile(url, outputPath) {
    const response = await sendApiRequest({
        url,
        responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
        response.data
            .pipe(fs.createWriteStream(outputPath))
            .on('finish', resolve)
            .on('error', reject);
    });
}

module.exports = {
    fetchFile,
    sendApiRequest,
};
