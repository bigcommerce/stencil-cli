const _ = require('lodash');
const Paper = require('@bigcommerce/stencil-paper');

/**
 * Ecapes html entities
 * 
 * @param {String} html 
 */
const escapeHtml = html => {
    const charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;',
    };

    return html.replace(/[&<>"]/g, tag => charsToReplace[tag] || tag);
};

/**
 * Scape special characters for regular expression
 *
 * @param {String} string
 */
const escapeRegex = string => string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");

/**
 * Returns template path
 * 
 * @param {String} request 
 * @param {Object} data 
 */
const getTemplatePath = (request, data) => {
    let path = data.template_file;

    if (request.headers['stencil-options']) {
        const options = JSON.parse(request.headers['stencil-options']);

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
 * Returns boolean if this handlebars version is supported 
 * 
 * @param {String} version 
 */
const isSupportedHandlebarsVersion = version => ['handlebars-v3', 'handlebars-v4'].includes(version);


/**
 * Output post-processing
 *
 * @param {Object} request
 * @param {Object} context
 * @param {String} content
 */
const makeDecorator = (request, context) => content => {
    let regex,
        debugBar;

    if (context.settings) {
        regex = new RegExp(escapeRegex(context.settings.base_url), 'g');
        content = content.replace(regex, '');

        regex = new RegExp(escapeRegex(context.settings.secure_base_url), 'g');
        content = content.replace(regex, '');
    }

    if (request.query.debug === 'bar') {
        debugBar = '<pre style="background-color:#EEE; word-wrap:break-word;">';
        debugBar += escapeHtml(JSON.stringify(context, null, 2)) + '</pre>';
        regex = new RegExp('</body>');
        content = content.replace(regex, debugBar + '\n</body>');
    }

    return content;
};


module.exports = function (data, assembler) {
    this.respond = function (request, h) {
        const templateEngine =  data.context.template_engine || "handlebars-v3";

        if (!isSupportedHandlebarsVersion(templateEngine)) {
            throw new Error('Provided Handlebars version is not supported! Please use:handlebars-v3, handlebars-v4');
        }

        const paper = new Paper(data.context.settings, data.context.theme_settings, assembler, templateEngine);
        // Set the environment to dev
        data.context.in_development = true;
        data.context.in_production = false;

        paper.addDecorator(makeDecorator(request, data.context));

        // Plugins have the opportunity to add/modify the response by using decorators
        _.each(request.app.decorators, function (decorator) {
            paper.addDecorator(decorator);
        });

        const templatePath = getTemplatePath(request, data);

        return paper.loadTheme(templatePath, data.acceptLanguage)
            .then(() => {
                if (request.query.debug === 'context') {
                    return data.context;
                }
            })
            .catch(err => console.error(err.message.red))
            .then(() => paper.renderTheme(templatePath, data))
            .catch(err => console.error(err.message.red))
            .then(output => {
                const response = h.response(output).code(data.statusCode);

                if (data.headers['set-cookie']) {
                    response.header('set-cookie', data.headers['set-cookie']);
                }

                return response;
            })
            .catch(err => console.error(err.message.red));
    };
};
