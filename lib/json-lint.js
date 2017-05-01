var jsonLint = require('jsonlint');

module.exports = {
    parse: function (jsonString, file) {
        file = file || '';

        try {
            return jsonLint.parse(jsonString);
        } catch (e) {
            throw new Error(file + ' - ' + e.message);
        }
    },
};
