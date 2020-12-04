/**
 * @module Contains helpers functions for working with network requests
 */

const https = require('https');
const fs = require('fs');
const axios = require('axios');

/** Used to send request to our (Bigcommerce) servers only.
 *  Shouldn't be used to send requests to third party servers because we disable https checks
 *
 * @param {object} options
 * @returns {Promise<object>}
 */
async function sendApiRequest(options) {
    return axios({
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        ...options,
    });
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
