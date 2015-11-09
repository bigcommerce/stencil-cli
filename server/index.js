var Fs = require('fs'),
    Glue = require('glue'),
    Hoek = require('hoek'),
    Path = require('path'),
    Url = require('url'),
    manifest = require('./manifest'),
    logo = require('./lib/showLogo'),
    internals = {};

require('colors');

module.exports = function(options, callback) {
    var config = manifest.get('/'),
        parsedSecureUrl = Url.parse(options.dotStencilFile.storeUrl), //The url to a secure page (prompted as login page)
        parsedNormalUrl = Url.parse(options.dotStencilFile.normalStoreUrl); //The host url of the homepage;

    callback = Hoek.nextTick(callback);

    config.connections[0].port = options.dotStencilFile.port;
    config.plugins['./plugins/Router'].storeUrl = parsedSecureUrl.protocol + '//' + parsedSecureUrl.host;
    config.plugins['./plugins/Router'].normalStoreUrl = parsedNormalUrl.protocol + '//' + parsedNormalUrl.host;
    config.plugins['./plugins/Router'].apiKey = options.dotStencilFile.apiKey;
    config.plugins['./plugins/Router'].port = options.dotStencilFile.port;
    config.plugins['./plugins/Router'].staplerUrl = options.dotStencilFile.staplerUrl;

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        if (err) {
            return callback(err);
        }

        server.start(function () {
            console.log(logo);

            if (options.stencilEditorEnabled) {
                return internals.startThemeEditor(options, callback);
            } else {
                return callback();
            }
        });

    });
};

internals.startThemeEditor = function(options, callback) {
    var themeEditorHost = 'http://localhost:' + options.stencilEditorPort;
    var stencilEditorConfig = {
        connections: [{
            host: 'localhost',
            port: options.stencilEditorPort
        }],
        plugins: {
            './plugins/StencilEditor': {
                variationIndex: options.variationIndex,
                stencilServerPort: options.dotStencilFile.stencilServerPort,
                themeEditorHost: themeEditorHost
            }
        }
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
