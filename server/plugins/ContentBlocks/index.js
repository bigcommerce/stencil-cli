var Path = require('path');
var Fs = require('fs');
var jsonLint = require('../../../lib/jsonLint');
var filePath = Path.join(process.cwd(), 'content-blocks.json');

module.exports.register = function (server, options, next) {

    server.ext('onRequest', function (request, reply) {

        request.app.preRenderEvents = request.app.preRenderEvents || [];

        // Add prerender event hook
        request.app.preRenderEvents.push(function (paper, done) {
            paper.regions = getRegions(); 
            done();
        });

        reply.continue();
    });

    next();
};

module.exports.register.attributes = {
    name: 'ContentBlocks',
    version: '0.0.1'
};

function getRegions() {
    var data;

    try {
        data = Fs.readFileSync(filePath, {encoding: 'utf-8'});
    } catch (err) {
        return [];
    }

    return jsonLint.parse(data, filePath).regions;
};
