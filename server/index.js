var Glue = require('glue'),
    Hoek = require('hoek'),
    Url = require('url'),
    manifest = require('./manifest'),
    logo = require('./lib/showLogo');

module.exports = function(dotStencilFile, callback) {
    var config = manifest.get('/'),
        parsedSecureUrl = Url.parse(dotStencilFile.storeUrl), //The url to a secure page (prompted as login page)
        parsedNormalUrl = Url.parse(dotStencilFile.normalStoreUrl); //The host url of the homepage

    callback = Hoek.nextTick(callback);

    config.connections[0].port = dotStencilFile.port;
    config.plugins['./plugins/Router'].storeUrl = parsedSecureUrl.protocol + '//' + parsedSecureUrl.host;
    config.plugins['./plugins/Router'].normalStoreUrl = parsedNormalUrl.protocol + '//' + parsedNormalUrl.host;
    config.plugins['./plugins/Router'].apiKey = dotStencilFile.apiKey;
    config.plugins['./plugins/Router'].port = dotStencilFile.port;
    config.plugins['./plugins/Router'].staplerUrl = dotStencilFile.staplerUrl;

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        if (err) {
            return callback(err);
        }

        //Event listener listening for state (cookie) validation failures.
        server.on('request-internal', function (request, event, tags) {
            if (tags.error && tags.state) {
                server.log('error', event);
            }
        });

        server.start(function () {
            server.log('info', logo);
            callback(null);
        });

    });
};
