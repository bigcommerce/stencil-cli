/**
 * @module Contains helpers functions for working with streams
 */

import { PassThrough } from 'stream';

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

function readStream(stream) {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            resolve(data);
        });
        stream.on('error', reject);
    });
}

function tapStream(originalStream, onData) {
    const tee = new PassThrough();
    originalStream.pipe(tee);

    let data = '';
    tee.on('data', (chunk) => {
        data += chunk;
    });
    tee.on('end', () => {
        onData(data);
    });

    return tee; // Use this stream for downstream consumers
}

export { readFromStream, tapStream, readStream };
export default {
    readFromStream,
    tapStream,
    readStream,
};
