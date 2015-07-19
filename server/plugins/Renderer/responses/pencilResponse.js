var _ = require('lodash'),
    Paper = require('stencil-paper'),
    LangParser = require('accept-language-parser'),
    Url = require('url'),
    internals = {};

module.exports = function (data) {
    this.respond = function (request, reply) {
        var response,
            output,
            html,
            preferredTranslation;

        // Remove the CDN prefixes in development
        data.context.cdn_url = '';
        data.context.cdn_url_with_settings_hash = '';
        // Set the environment to dev
        data.context.in_development = true;
        data.context.in_production = false;

        if (request.query.debug === 'context') {
            return reply(data.context);
        }

        preferredTranslation = internals.getPreferredTranslation(
            data.acceptLanguage,
            data.translations
        );

        if (data.content_type === 'application/json') {
            // Translate errors
            if (data.method === 'post' && _.isArray(data.context.errors)) {
                data.context.errors = internals.translateErrors(data.context.errors, preferredTranslation);
            }

            if (data.template_file) {
                // if multiple render_with
                if (_.isArray(data.template_file)) {
                    // if data.template_file is an array ( multiple templates using render_with option)
                    // compile all the template required files into a hash table
                    html = data.template_file.reduce(function(table, file) {
                        table[file] = Paper.compile(file, data.templates, data.context, preferredTranslation);
                        table[file] = internals.decorateOutput(table[file], request, data);

                        return table;
                    }, {});
                } else {
                    html = Paper.compile(data.template_file, data.templates, data.context, preferredTranslation);
                    html = internals.decorateOutput(html, request, data);
                }

                if (data.remote) {
                    // combine the context & rendered html
                    output = {
                        data: data.context,
                        content: html
                    };
                } else {
                    output = html;
                }
            } else {
                output = {
                    data: data.context
                };
            }
        } else {
            output = Paper.compile(data.template_file, data.templates, data.context, preferredTranslation);
            output = internals.decorateOutput(output, request, data);
        }

        response = reply(output);
        response.code(data.statusCode);

        if (data.headers['set-cookie']) {
            response.header('set-cookie', data.headers['set-cookie']);
        }
    };
};

/**
 * Output post-processing
 *
 * @param content
 * @param request
 * @param data
 */
internals.decorateOutput = function (content, request, data) {
    var regex;

    if (data.context.settings) {
        regex = new RegExp(internals.escapeRegex(data.context.settings.base_url), 'g');
        content = content.replace(regex, 'http://' + request.info.host);

        regex = new RegExp(internals.escapeRegex(data.context.settings.secure_base_url), 'g');
        content = content.replace(regex, 'http://' + request.info.host);

    }

    if (request.query.debug === 'bar') {
        var debugBar = '<pre style="background-color:#EEE; word-wrap:break-word;">';
        debugBar += internals.escapeHtml(JSON.stringify(data.context, null, 2)) + '</pre>';
        regex = new RegExp('</body>');
        content = content.replace(regex, debugBar + '\n</body>');
    }

    return content;
};

/**
 * Scape html entities
 */
internals.escapeHtml = function () {
    var charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;'
    };

    return function (html) {
        return html.replace(/[&<>"]/g, function (tag) {
            return charsToReplace[tag] || tag;
        });
    }
}();

/**
 * Scape special characters for regular expression
 *
 * @param string
 */
internals.escapeRegex = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};

/**
 * Translate an array of error keys
 * @param  {Array} errors
 * @param  {Object} translations
 * @return {Object}
 */
internals.translateErrors = function (errors, translations) {
    return errors.map(function(errorKey) {
        var translate = translations['errors.' + errorKey];
        return (typeof translate === 'function') ? translate() : errorKey;
    });
};

internals.getPreferredTranslation = function (acceptLanguage, translations) {
    // default the preferred translation
    var compiledTranslations = Paper.compileTranslations('en', translations),
        preferredTranslation = compiledTranslations['en'] || {},
        preferredLang = LangParser.parse(acceptLanguage);
    // march down the preferred languages and use the first translatable locale
    _.each(preferredLang, function(acceptedLang) {
        var suitableLang = acceptedLang.code;

        if (_.isString(acceptedLang.region)) {
            suitableLang += '-' + acceptedLang.region;
        }

        if (compiledTranslations[suitableLang]) {
            preferredTranslation = compiledTranslations[suitableLang];
            return false;
        }
    });

    return preferredTranslation;
};
