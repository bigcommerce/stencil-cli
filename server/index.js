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

    Glue.compose(config, { relativeTo: __dirname }, (err, server) => {
        if (err) {
            return callback(err);
        }

        server.register([
            // Third Party Plugins
            {
                register: require('good'),
                options: require('./config').get('/good'),
            },
            require('inert'),
            require('h2o2'),
            // First Party Plugins
            {
                register: require('./plugins/renderer/renderer.module'),
                options: {
                    useCache: options.useCache,
                    username: options.dotStencilFile.username,
                    token: options.dotStencilFile.token,
                    clientId: options.dotStencilFile.clientId,
                    accessToken: options.dotStencilFile.accessToken,
                    customLayouts: options.dotStencilFile.customLayouts,
                    stencilEditorPort: options.stencilEditorPort,
                    themePath: options.themePath,
                },
            },
            {
                register: require('./plugins/router/router.module'),
                options: {
                    storeUrl: parsedSecureUrl.protocol + '//' + parsedSecureUrl.host,
                    normalStoreUrl: parsedNormalUrl.protocol + '//' + parsedNormalUrl.host,
                    apiKey: options.dotStencilFile.apiKey,
                    port: options.dotStencilFile.port,
                    staplerUrl: options.dotStencilFile.staplerUrl,
                },
            },
            {
                register: require('./plugins/theme-assets/theme-assets.module'),
                options: {
                    themePath: options.themePath,
                },
            },
        ], (error) => {
            if (error) {
                throw error;
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
    });
};

internals.startThemeEditor = (options, callback) => {
    const themeEditorHost = 'http://localhost:' + options.stencilEditorPort;
    const stencilEditorConfig = {
        connections: [{
            host: 'localhost',
            port: options.stencilEditorPort,
        }],
    };

    Glue.compose(stencilEditorConfig, { relativeTo: __dirname }, (err, server) => {
        if (err) {
            return callback(err);
        }

        server.register([
            require('vision'),
            require('inert'),
            {
                register: require('./plugins/stencil-editor/stencil-editor.module'),
                options: {
                    variationIndex: options.variationIndex,
                    stencilServerPort: options.dotStencilFile.stencilServerPort,
                    stencilEditorPort: options.stencilEditorPort,
                    themeEditorHost: themeEditorHost,
                    themeServer: options.themeServer,
                    themePath: options.themePath,
                },
            }], (error) => {
                if (error) {
                    throw error;
                }

                server.start(() => {
                    console.log('Theme Editor:', themeEditorHost.cyan);
                    return callback();
                });
            });
    });
};
