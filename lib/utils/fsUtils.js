import fs from 'fs';
import recursiveReadDir from 'recursive-readdir';
import { parse } from '../parse-json.js';
/**
 * @param {string} filePath
 * @returns {Promise<Object>} - parsed JSON content of the file
 */
async function parseJsonFile(filePath) {
    const contentStr = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    // We use parse-json instead of JSON.parse because it throws errors with better explanations what is wrong
    return parse(contentStr, filePath);
}
export { parseJsonFile };
export { recursiveReadDir };
export default {
    ...fs,
    parseJsonFile,
    recursiveReadDir,
};
