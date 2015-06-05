var Glue = require('glue'),
    Hoek = require('hoek'),
    manifest = require('./manifest'),
    logo = require('./lib/showLogo');

module.exports = function(dotStencilFile, callback) {
    var config = manifest.get('/');

    callback = Hoek.nextTick(callback);

    config.connections[0].port = dotStencilFile.port;
    config.plugins['./plugins/Router'].storeUrl = dotStencilFile.storeUrl;
    config.plugins['./plugins/Router'].apiKey = dotStencilFile.apiKey;
    config.plugins['./plugins/Router'].port = dotStencilFile.port;
    config.plugins['./plugins/Router'].staplerUrl = dotStencilFile.staplerUrl;

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
