import parseJson from 'parse-json';

export function parse(jsonString, file = '') {
    try {
        return parseJson(jsonString);
    } catch (e) {
        throw new Error(`${file} - ${e.message}`);
    }
}
export default {
    parse,
};
