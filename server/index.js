'use strict';

const Glue = require('glue');
const Hoek = require('hoek');
const Url = require('url');
const manifest = require('./manifest');
const logo = require('./lib/show-logo');
const internals = {};

require('colors');

module.exports = function(options, callback) {
    var config = manifest.get('/'),
        parsedSecureUrl = Url.parse(options.dotStencilFile.storeUrl), //The url to a secure page (prompted as login page)
        parsedNormalUrl = Url.parse(options.dotStencilFile.normalStoreUrl); //The host url of the homepage;

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
    config.plugins['./plugins/renderer/renderer.module'].customLayouts = options.dotStencilFile.customLayouts;
    config.plugins['./plugins/renderer/renderer.module'].stencilEditorPort = options.stencilEditorPort;

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        if (err) {
            return callback(err);
        }

        server.start(function () {
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

internals.startThemeEditor = function(options, callback) {
    var themeEditorHost = 'http://localhost:' + options.stencilEditorPort;
    var stencilEditorConfig = {
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
            },
        },
    };

    Glue.compose(stencilEditorConfig, {relativeTo: __dirname}, function (err, server) {
        if (err) {
            return callback(err);
        }

        server.start(function () {
            console.log('Theme Editor:', themeEditorHost.cyan);
            return callback();
        });
    });
};
