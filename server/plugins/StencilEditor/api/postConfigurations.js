var Cache = require('memory-cache');
var _ = require('lodash');

/**
 * Returns a request handler for POST /api/configurations
 * @param  {Object} options
 * @param  {Object} themeConfig
 */
module.exports = function (options, themeConfig) {

    /**
     * Request Handler
     * @param  {Object} request
     * @param  {Object} reply
     */
    return function (request, reply) {
        var payload = request.payload || {};
        var variationIndex = _.parseInt(payload.variationId - 1);
        var saveToFile = !payload.preview;

        themeConfig.setVariation(variationIndex);
            
        themeConfig.updateConfig(payload.settings, saveToFile);

        Cache.clear();

        reply({
            data: {
                configurationId: variationIndex + 1
            },
            meta: {}
        });
    };
};
