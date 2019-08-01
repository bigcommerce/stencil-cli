'use strict';

const Glue = require('glue');
const Hoek = require('hoek');
const Url = require('url');
const manifest = require('./manifest');
const logo = require('./lib/show-logo');
const internals = {};

require('colors');

module.exports = (options, callback) => {
    const config = manifest.get('/');
    const parsedSecureUrl = Url.parse(options.dotStencilFile.storeUrl); //The url to a secure page (prompted as login page)
    const parsedNormalUrl = Url.parse(options.dotStencilFile.normalStoreUrl); //The host url of the homepage;

    callback = Hoek.nextTick(callback);

    config.connections[0].port = options.dotStencilFile.port;
    config.plugins['./plugins/router/router.module'].storeUrl = parsedSecureUrl.protocol + '//' + parsedSecureUrl.host;
    config.plugins['./plugins/router/router.module'].normalStoreUrl = parsedNormalUrl.protocol + '//' + parsedNormalUrl.host;
    config.plugins['./plugins/router/router.module'].apiKey = options.dotStencilFile.apiKey;
    config.plugins['./plugins/router/router.module'].port = options.dotStencilFile.port;
    config.plugins['./plugins/router/router.module'].staplerUrl = options.dotStencilFile.staplerUrl;
    config.plugins['./plugins/renderer/renderer.module'].useCache = options.useCache;
    config.plugins['./plugins/renderer/renderer.module'].username = options.dotStencilFile.username;
    config.plugins['./plugins/renderer/renderer.module'].token = options.dotStencilFile.token;
    config.plugins['./plugins/renderer/renderer.module'].accessToken = options.dotStencilFile.accessToken;
    config.plugins['./plugins/renderer/renderer.module'].customLayouts = options.dotStencilFile.customLayouts;
    config.plugins['./plugins/renderer/renderer.module'].stencilEditorPort = options.stencilEditorPort;
    config.plugins['./plugins/renderer/renderer.module'].themePath = options.themePath;
    config.plugins['./plugins/theme-assets/theme-assets.module'].themePath = options.themePath;

    Glue.compose(config, {relativeTo: __dirname}, (err, server) => {
        if (err) {
            return callback(err);
        }

        server.start(() => {
            console.log(logo);

            if (options.stencilEditorEnabled) {
                options.themeServer = server;

                return internals.startThemeEditor(options, callback);
            } else {
                return callback(null, server);
            }
        });

    });
};

internals.startThemeEditor = (options, callback) => {
    const themeEditorHost = 'http://localhost:' + options.stencilEditorPort;
    const stencilEditorConfig = {
        connections: [{
            host: 'localhost',
            port: options.stencilEditorPort,
        }],
        plugins: {
            './plugins/stencil-editor/stencil-editor.module': {
                variationIndex: options.variationIndex,
                stencilServerPort: options.dotStencilFile.stencilServerPort,
                stencilEditorPort: options.stencilEditorPort,
                themeEditorHost: themeEditorHost,
                themeServer: options.themeServer,
                themePath: options.themePath,
            },
        },
    };

    Glue.compose(stencilEditorConfig, {relativeTo: __dirname}, (err, server) => {
        if (err) {
            return callback(err);
        }

        server.start(() => {
            console.log('Theme Editor:', themeEditorHost.cyan);
            return callback();
        });
    });
};
