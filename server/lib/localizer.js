var _ = require('lodash'),
    parser = require('accept-language-parser');

module.exports.getPreferredTranslation = function(acceptLanguageHeader, translations) {
    // default the preferred translation
    var preferredTranslation = translations['en'],
        preferredLang = parser.parse(acceptLanguageHeader);
    // march down the preferred languages and use the first translatable locale
    _.each(preferredLang, function(acceptedLang) {
        var suitableLang = acceptedLang.code;

        if (_.isString(acceptedLang.region)) {
            suitableLang += '-' + acceptedLang.region;
        }

        if (translations[suitableLang]) {
            preferredTranslation = translations[suitableLang];
            return false;
        }
    });

    return preferredTranslation;
};

module.exports.translateErrors = function (errors, translations) {
    return errors.reduce(function(table, errorKey) {
        var translate = translations['errors.' + errorKey];

        table[errorKey] = (typeof translate === 'function') ? translate() : errorKey;

        return table;
    }, {});
};
