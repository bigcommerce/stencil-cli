const _ = require('lodash');
const Paper = require('@bigcommerce/stencil-paper');

/**
 * Escapes html entities
 *
 * @param {string} html
 */
const escapeHtml = (html) => {
    const charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;',
    };

    return html.replace(/[&<>"]/g, (tag) => charsToReplace[tag] || tag);
};

/**
 * Scape special characters for regular expression
 *
 * @param {string} string
 */
const escapeRegex = (string) => string.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Returns template path
 *
 * @param {string} request
 * @param {Object} data
 * @returns {string|string[]}
 */
const getTemplatePath = (request, data) => {
    let paths = data.template_file;

    if (request.headers['stencil-options']) {
        const options = JSON.parse(request.headers['stencil-options']);

        if (options.render_with && typeof options.render_with === 'string') {
            const componentsToRender = options.render_with.split(',');

            paths = componentsToRender.map((component) => `components/${component}`);

            if (paths.length === 1) {
                [paths] = paths;
            }
        }
    }

    return paths;
};

/**
 * Returns boolean if this handlebars version is supported
 *
 * @param {string} version
 */
const isSupportedHandlebarsVersion = (version) =>
    ['handlebars-v3', 'handlebars-v4'].includes(version);

/**
 * Node.js projects are using variables in format: handlebars-v3, handlebars-v4;
 * Storefront and db are using format: handlebars_v3, handlebars_v4;
 * This function converts _v3 to -v3
 *
 * @param {string} version
 */
const compatibilizeTemplateEngine = (version) => version.replace('_', '-');

/**
 * Output post-processing
 *
 * @param {Object} request
 * @param {Object} context
 */
const makeDecorator = (request, context) => (content) => {
    let updatedContent = content;

    if (context.settings) {
        const baseUrlregex = new RegExp(escapeRegex(context.settings.base_url), 'g');
        updatedContent = content.replace(baseUrlregex, '');

        const secureBaseUrlRegex = new RegExp(escapeRegex(context.settings.secure_base_url), 'g');
        updatedContent = content.replace(secureBaseUrlRegex, '');
    }

    if (request.query.debug === 'bar') {
        const contextStr = escapeHtml(JSON.stringify(context, null, 2));
        const debugBar = `<pre style="background-color:#EEE; word-wrap:break-word;"> ${contextStr} </pre>`;
        const bodyRegex = new RegExp('</body>');
        updatedContent = content.replace(bodyRegex, `${debugBar}\n</body>`);
    }

    return updatedContent;
};

class PencilResponse {
    /**
     * @param {Object} data
     * @param data.template_file
     * @param data.templates
     * @param data.remote
     * @param data.remote_data
     * @param data.context
     * @param data.translations
     * @param data.method
     * @param data.acceptLanguage
     * @param {{[string]: string[]}} data.headers
     * @param data.statusCode
     * @param data.renderedRegions
     * @param assembler
     */
    constructor(data, assembler) {
        this.data = data;
        this.assembler = assembler;
    }

    async respond(request, h) {
        const templateEngine = compatibilizeTemplateEngine(
            this.data.context.template_engine || 'handlebars-v3',
        );

        if (!isSupportedHandlebarsVersion(templateEngine)) {
            throw new Error(
                'Provided Handlebars version is not supported! Please use:handlebars-v3, handlebars-v4',
            );
        }

        const paper = new Paper(
            this.data.context.settings,
            this.data.context.theme_settings,
            this.assembler,
            templateEngine,
        );
        // Set the environment to dev
        this.data.context.in_development = true;
        this.data.context.in_production = false;

        paper.addDecorator(makeDecorator(request, this.data.context));
        paper.setContent(this.data.renderedRegions);

        // Plugins have the opportunity to add/modify the response by using decorators
        _.each(request.app.decorators, (decorator) => {
            paper.addDecorator(decorator);
        });

        const templatePath = getTemplatePath(request, this.data);

        if (request.query.debug === 'context') {
            return this.data.context;
        }

        try {
            await paper.loadTheme(templatePath, this.data.acceptLanguage);
            const output = await paper.renderTheme(templatePath, this.data);

            const response = h.response(output).code(this.data.statusCode);

            if (this.data.headers['set-cookie']) {
                response.header('set-cookie', this.data.headers['set-cookie']);
            }

            return response;
        } catch (err) {
            console.error(err.message.red);
            return h.response().code(500);
        }
    }
}

module.exports = PencilResponse;
