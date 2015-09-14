var _ = require('lodash'),
    Paper = require('stencil-paper')(),
    Url = require('url'),
    internals = {};

module.exports = function (data) {
    this.respond = function (request, reply) {
        var response,
            output,
            html,
            theme;

        // Remove the CDN prefixes in development
        data.context.cdn_url = '';
        data.context.cdn_url_with_settings_hash = '';
        // Set the environment to dev
        data.context.in_development = true;
        data.context.in_production = false;

        theme = Paper.make(1);

        theme.loadTranslations(data.acceptLanguage, data.translations);
        theme.addDecorator(internals.makeDecorator(request, data.context));
        theme.loadTemplatesSync(data.templates);

        if (request.query.debug === 'context') {
            return reply(data.context);
        }

        if (data.content_type === 'application/json') {
            
            if (data.remote) {
                data.context = _.extend({}, data.context, data.remote_data);
            }

            if (data.template_file) {
                // if multiple render_with
                if (_.isArray(data.template_file)) {
                    // if data.template_file is an array ( multiple templates using render_with option)
                    // compile all the template required files into a hash table
                    html = data.template_file.reduce(function(table, file) {
                        table[file] = theme.render(file, data.context);

                        return table;
                    }, {});
                } else {
                    html = theme.render(data.template_file, data.context);
                }

                if (data.remote) {
                    // combine the context & rendered html
                    output = {
                        data: data.remote_data,
                        content: html
                    };
                } else {
                    output = html;
                }
            } else {
                output = {
                    data: data.remote_data
                };
            }
        } else {
            output = theme.render(data.template_file, data.context);
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
internals.makeDecorator = function (request, context) {

    return function(content) {
        var regex;

        if (context.settings) {
            regex = new RegExp(internals.escapeRegex(context.settings.base_url), 'g');
            content = content.replace(regex, '');

            regex = new RegExp(internals.escapeRegex(context.settings.secure_base_url), 'g');
            content = content.replace(regex, '');

        }

        if (request.query.debug === 'bar') {
            var debugBar = '<pre style="background-color:#EEE; word-wrap:break-word;">';
            debugBar += internals.escapeHtml(JSON.stringify(context, null, 2)) + '</pre>';
            regex = new RegExp('</body>');
            content = content.replace(regex, debugBar + '\n</body>');
        }

        return content;
    }
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
