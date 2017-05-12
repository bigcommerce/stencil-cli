const Path = require('path');
const Url = require('url');
const Utils = require('../../../lib/utils');

/**
 * Returns a request handler for GET /api/versions/{versionId}
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

        themeConfig.getSchema(function(err, schema) {
            if (err) {
                return reply({
                    errors: [
                        {
                            type: 'parse_error',
                            title: 'Parse Error',
                            detail: err.message,
                        },
                    ],
                }).code(400);
            }

            if (schema.length === 0) {
                // Warn the user that there is no schema.jon file
                request.log("No schema.json found in the theme directory. ");
            }

            reply({
                data: {
                    id: Utils.int2uuid(1),
                    name: themeConfig.getName(),
                    price: themeConfig.getPrice(),
                    displayVersion: themeConfig.getVersion(),
                    editorSchema: schema,
                    status: 'draft',
                    numVariations: themeConfig.getVariationCount(),
                    defaultVariationId: Utils.int2uuid(themeConfig.variationIndex + 1),
                    screenshot: getScreenshotUrl(options, themeConfig.getComposedImage()),
                },
                meta: themeConfig.getMeta(),
            });
        });
    };
};

function getScreenshotUrl(options, image) {
    var path = Path.join('meta',  image || '');
    return Url.resolve(options.themeEditorHost, path);
}
