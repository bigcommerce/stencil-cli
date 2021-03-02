/**
 * @module Contains helpers functions for working with async stuff and streams
 */

/**
 * WARNING! Can be used with text content only. Binary data (e.g. images) will get broken!
 *
 * @param {ReadableStream} stream
 * @returns {Promise<string>}
 */
async function readFromStream(stream) {
    let result = '';
    for await (const chunk of stream) {
        result += chunk;
    }
    return result;
}

module.exports = {
    readFromStream,
};
