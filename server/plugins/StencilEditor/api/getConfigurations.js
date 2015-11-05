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
        reply({
            data: {
                id: 'theme',
                variationId: themeConfig.variationIndex + 1,
                storeHash: 'hash',
                settings: themeConfig.getConfig().settings
            },
            meta: {}
        });
    };
};
