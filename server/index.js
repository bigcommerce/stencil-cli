var _ = require('lodash'),
    Glue = require('glue'),
    Hoek = require('hoek'),

    manifest = require('./manifest'),
    config = require('./config'),
    logo = require('./lib/showLogo');

module.exports = function(dotPaperclipFile) {
    var config = manifest.get('/');

    config.connections[0].port = dotPaperclipFile.port;
    config.plugins['./plugins/Router'].storeUrl = dotPaperclipFile.storeUrl;
    config.plugins['./plugins/Router'].apiKey = dotPaperclipFile.apiKey;

    Glue.compose(config, {relativeTo: __dirname}, function (err, server) {
        server.start(function () {
            server.log('info', logo + 'Server running at: ' + server.connections[0].info.uri);
        });
    });
};
