const Handlebars = require('handlebars');
const Hoek = require('hoek');
const Path = require('path');
const ThemeConfig = require('../../../lib/theme-config');
const Utils = require('../../lib/utils');
const handlers = {};
const querystring = require('querystring');
const internals = {
    options: {},
};
const themeConfig = ThemeConfig.getInstance();

module.exports.register = (server, options, next) => {
    var configurationId;
    var variationId;
    const routesConfig = {
        state: {
            parse: false, // do not parse cookies
        },
    };

    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.views({
        engines: {
            html: Handlebars,
        },
        relativeTo: __dirname,
        path: './',
    });

    // On Request event handler to add the SDK to the footer
    options.themeServer.ext('onRequest', handlers.onRequest);

    // When using stencil-cli variationId = configurationId
    configurationId = Utils.int2uuid(themeConfig.variationIndex + 1);
    variationId = Utils.int2uuid(themeConfig.variationIndex + 1);

    server.route([
        {
            method: 'GET',
            path: '/',
            config: routesConfig,
            handler: (request, reply) => reply.redirect(`/theme-editor/theme/${variationId}/${configurationId}`),
        },
        {
            method: 'GET',
            path: '/manage/theme-editor',
            config: routesConfig,
            handler: (request, reply) => {
                const params = querystring.stringify(request.query);
                reply.redirect(`/theme-editor/theme/${variationId}/${configurationId}?${params}`)
            },
        },
        {
            method: 'GET',
            path: '/admin/remote.php',
            config: routesConfig,
            handler: (request, reply) => reply({ status: 'ALIVE' }),
        },
        {
            method: 'GET',
            path: '/admin/events/stencil',
            config: routesConfig,
            handler: (request, reply) => reply().code(204),
        },
        {
            method: 'GET',
            path: '/theme-editor/{versionId}/{variationId}/{configurationId}',
            config: routesConfig,
            handler: (request, reply) => handlers.home(request, reply),
        },
        {
            method: 'GET',
            path: '/{path*}',
            config: routesConfig,
            handler: {
                directory: {
                    path: Path.join(__dirname, './public'),
                },
            },
        },
        {
            method: 'GET',
            path: '/bower/ng-stencil-editor/dist/svg/{path*}',
            config: routesConfig,
            handler: {
                directory: {
                    path: Path.join(__dirname, './public/dist/ng-stencil-editor/svg/'),
                },
            },
        },
        {
            method: 'GET',
            path: '/meta/{path*}',
            config: routesConfig,
            handler: {
                directory: {
                    path: Path.join(internals.options.themePath, 'meta'),
                },
            },
        },
        {
            method: 'GET',
            path: '/api/themeeditor/variations/{variationId}',
            config: routesConfig,
            handler: require('./api/getVariations')(internals.options, themeConfig),
        },
        {
            method: 'GET',
            path: '/api/themeeditor/configurations/{configurationId}',
            config: routesConfig,
            handler: require('./api/getConfigurations')(internals.options, themeConfig),
        },
        {
            method: 'POST',
            path: '/api/themeeditor/configurations',
            config: routesConfig,
            handler: require('./api/postConfigurations')(internals.options, themeConfig),
        },
        {
            method: 'GET',
            path: '/admin/services/themes/stores/{hash}/versions/{versionId}',
            config: routesConfig,
            handler: require('./api/getVersions')(internals.options, themeConfig),
        },
        {
            method: 'GET',
            path: '/api/marketplace/variations/{variationId}/history',
            config: routesConfig,
            handler: (request, reply) => reply().code(200),
        },
        {
            method: 'POST',
            path: '/admin/events/stencil',
            config: routesConfig,
            handler: (request, reply) => reply().code(200),
        },
    ]);

    return next();
};

/**
 * Adds the SDK script to the iframe
 *
 * @param request
 * @param reply
 */
handlers.onRequest = (request, reply) => {
    request.app.decorators = request.app.decorators || [];

    // Only add the SDK if stencilEditor is a query parameter or the cookie preview_config_id is set
    if (request.query.stencilEditor || (request.headers.cookie || '').indexOf('stencil_preview') !== -1) {
        request.app.decorators.push(content => {
            const scriptTags = `<script src="//localhost:${internals.options.stencilEditorPort}/dist/stencil-preview-sdk.js"></script>\n`;
            return content.replace(new RegExp('</body>'), `${scriptTags}\n</body>`);
        });
    }

    reply.continue();
};

/**
 * Render main page that boots up stencil-editor
 *
 * @param request
 * @param reply
 */
handlers.home = (request, reply) => {
    const shopPath = `http://localhost:${internals.options.stencilServerPort}`;
    const cdnPath = `//localhost:${internals.options.stencilEditorPort}`;

    reply.view('stencil-editor', {
        shopPath,
        cdnPath,
        themeName: themeConfig.getName(),
        variationName: themeConfig.getVariationName(),
        displayVersion: themeConfig.getVersion(),
    });
};

module.exports.register.attributes = {
    name: 'stencil-editor',
    version: '0.0.1',
};
