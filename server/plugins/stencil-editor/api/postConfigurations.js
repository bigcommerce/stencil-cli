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
        var variationIndex = _.parseInt(payload.variationId - 1, 10);
        var saveToFile = !payload.preview;

        if (payload.reset || payload.publish) {
            return reply({
                errors: [
                    {
                        type: 'not_available',
                        title: 'Reset is not available',
                        detail: 'Reset Is not possible while using stencil-cli.'
                    }
                ]
            }).code(405);
        }

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
