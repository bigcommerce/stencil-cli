const _ = require('lodash');
const Paper = require('@bigcommerce/stencil-paper');
const internals = {};

module.exports = function (data, assembler) {
    this.respond = function (request, reply) {
        const paper = new Paper(data.context.settings, data.context.theme_settings, assembler, "handlebars-v3");

        // Set the environment to dev
        data.context.in_development = true;
        data.context.in_production = false;

        paper.addDecorator(internals.makeDecorator(request, data.context));

        // Plugins have the opportunity to add/modify the response by using decorators
        _.each(request.app.decorators, function (decorator) {
            paper.addDecorator(decorator);
        });

        const templatePath = internals.getTemplatePath(request, data);

        paper.loadTheme(templatePath, data.acceptLanguage)
            .then(() => {
                if (request.query.debug === 'context') {
                    return reply(data.context);
                }
            })
            .catch(err => console.error(err.message.red))
            .then(() => paper.renderTheme(templatePath, data))
            .catch(err => console.error(err.message.red))
            .then(output => {
                const response = reply(output);
                response.code(data.statusCode);
                if (data.headers['set-cookie']) {
                    response.header('set-cookie', data.headers['set-cookie']);
                }
                return response;
            }).catch(err => console.error(err.message.red));
    };
};


internals.getTemplatePath = function (request, data) {
    var path = data.template_file;

    if (request.headers['stencil-options']) {
        var options = JSON.parse(request.headers['stencil-options']);

        if (options['render_with'] && typeof options['render_with'] === 'string') {

            path = options['render_with'].split(',');

            path = _.map(path, function (path) {
                return 'components/' + path;
            });

            if (path.length === 1) {
                path = path[0];
            }
        }
    }

    return path;
};


/**
 * Output post-processing
 *
 * @param request
 * @param context
 */
internals.makeDecorator = function (request, context) {
    return function(content) {
        var regex,
            debugBar;

        if (context.settings) {
            regex = new RegExp(internals.escapeRegex(context.settings.base_url), 'g');
            content = content.replace(regex, '');

            regex = new RegExp(internals.escapeRegex(context.settings.secure_base_url), 'g');
            content = content.replace(regex, '');
        }

        if (request.query.debug === 'bar') {
            debugBar = '<pre style="background-color:#EEE; word-wrap:break-word;">';
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
internals.escapeHtml = function (html) {
    const charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;',
    };

    return html.replace(/[&<>"]/g, tag => charsToReplace[tag] || tag);
}

/**
 * Scape special characters for regular expression
 *
 * @param string
 */
internals.escapeRegex = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};
