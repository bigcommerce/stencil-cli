/**
 * @module Contains helpers functions for working with async stuff and streams
 */

/**
 * @param {ReadableStream} stream
 * @returns {Promise<string>}
 */
function readFromStream(stream) {
    return new Promise((resolve, reject) => {
        let data = "";

        stream.on("data", chunk => data += chunk);
        stream.on("end", () => resolve(data));
        stream.on("error", error => reject(error));
    });
}

module.exports = {
    readFromStream,
};
