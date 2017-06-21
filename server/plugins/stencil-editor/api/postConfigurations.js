'use strict';

const Cache = require('memory-cache');
const Utils = require('../../../lib/utils');

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
        const payload = request.payload || {};
        const saveToFile = !payload.preview;

        if (!payload.variationId || payload.reset || payload.publish) {
            return reply({
                errors: [
                    {
                        type: 'not_available',
                        title: 'Reset is not available',
                        detail: 'Reset Is not possible while using stencil-cli.',
                    },
                ],
            }).code(405);
        }

        const variationIndex = Utils.uuid2int(payload.variationId) - 1;
        themeConfig.setVariation(variationIndex);

        themeConfig.updateConfig(payload.settings, saveToFile);

        Cache.clear();

        reply({
            data: {
                configurationId: Utils.int2uuid(variationIndex + 1),
            },
            meta: {},
        });
    };
};
