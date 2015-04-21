var Glue = require('glue'),
    manifest = require('./manifest'),
    config = require('./config'),
    logo = require('./lib/showLogo');

module.exports = function(dotStencilFile) {
    var config = manifest.get('/');

    config.connections[0].port = dotStencilFile.port;
    config.plugins['./plugins/Router'].storeUrl = dotStencilFile.storeUrl;
    config.plugins['./plugins/Router'].apiKey = dotStencilFile.apiKey;
    config.plugins['./plugins/Router'].staplerUrl = dotStencilFile.staplerUrl || 'https://bc-stapler.herokuapp.com';

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        server.start(function () {
            server.log('info', logo + 'Server running at: ' + server.connections[0].info.uri);
        });
    });
};
