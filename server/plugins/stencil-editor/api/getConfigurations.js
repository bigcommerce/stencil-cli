const Utils = require('../../../lib/utils');

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
        var variationIndex = Utils.uuid2int(request.params.configurationId) - 1;

        themeConfig.setVariation(variationIndex);

        reply({
            data: {
                id: Utils.int2uuid(themeConfig.variationIndex + 1),
                variationId: Utils.int2uuid(themeConfig.variationIndex + 1),
                storeHash: 'hash',
                settings: themeConfig.getConfig().settings,
            },
            meta: {},
        });
    };
};
