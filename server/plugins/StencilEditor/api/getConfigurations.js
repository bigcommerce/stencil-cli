var _ = require('lodash');

/**
 * Returns a request handler for GET /api/configurations/{configurationId}
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
        var variationIndex = _.parseInt(request.params.configurationId - 1, 10);

        themeConfig.setVariation(variationIndex);

        reply({
            data: {
                id: themeConfig.variationIndex + 1,
                variationId: themeConfig.variationIndex + 1,
                storeHash: 'hash',
                settings: themeConfig.getConfig().settings
            },
            meta: {}
        });
    };
};
