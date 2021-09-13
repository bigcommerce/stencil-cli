const parseJson = require('parse-json');

module.exports = {
    parse(jsonString, file = '') {
        try {
            return parseJson(jsonString);
        } catch (e) {
            throw new Error(`${file} - ${e.message}`);
        }
    },
};
