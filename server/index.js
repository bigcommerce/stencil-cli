var Glue = require('glue'),
    Hoek = require('hoek'),
    Url = require('url'),
    manifest = require('./manifest'),
    logo = require('./lib/showLogo');

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
    config.plugins['./plugins/Router'].themeConfig = options.themeConfig;

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        if (err) {
            return callback(err);
        }

        server.start(function () {
            server.log('info', logo);
            callback(null);
        });

    });
};
