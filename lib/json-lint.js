const jsonLint = require('jsonlint');

module.exports = {
    parse(jsonString, file = '') {
        try {
            return jsonLint.parse(jsonString);
        } catch (e) {
            throw new Error(`${file} - ${e.message}`);
        }
    },
};
