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
        var variationIndex = parseInt(payload.variationId - 1);
        var saveToFile = !payload.preview;

        if (themeConfig.variationIndex !== variationIndex) {
            themeConfig.setVariation(variationIndex);
        }
            
        themeConfig.updateConfig(payload.settings, saveToFile);

        reply({
            data: {
                configurationId: variationIndex + 1
            },
            meta: {}
        });
    };
};
