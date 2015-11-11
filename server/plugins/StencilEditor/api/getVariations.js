var Path = require('path');
var Url = require('url');
var _ = require('lodash');

/**
 * Returns a request handler for GET /api/variations/{variationId}
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
        var variationIndex = _.parseInt(request.params.variationId - 1, 10);
        var variation;
        var desktopScreenshot;
        var mobileScreenshot;

        themeConfig.setVariation(variationIndex);

        try {
            // Get the selected variation
            variation = themeConfig.getCurrentVariation();

        } catch (err) {
            return reply({
                errors: [
                    {
                        type: "not_found",
                        title: "Not Found",
                        detail: "Variation ID not found"
                    }
                ]
            }).code(404);
        }

        // Get the preview images urls
        desktopScreenshot = getScreenshotUrl(options, variation.meta.desktop_screenshot);
        mobileScreenshot = getScreenshotUrl(options, variation.meta.mobile_screenshot);

        reply({
            data: {
                id: variationIndex + 1,
                themeName: themeConfig.getName(),
                themeId: "theme",
                versionId: themeConfig.getVersion(),
                variationName: themeConfig.getVariationName(),
                price: themeConfig.getPrice(),
                partner: {
                    id: "string",
                    name: "string",
                    contactUrl: "string",
                    contactEmail: "string"
                },
                description: themeConfig.getDescription(),
                industries: variation.meta.industries,
                features: variation.meta.features,
                optimizedFor: variation.meta.optimizedFor,
                screenshot: {
                    largePreview: desktopScreenshot,
                    largeThumb: desktopScreenshot,
                    smallThumb: desktopScreenshot
                },
                mobileScreenshot: mobileScreenshot,
                demoUrl: variation.meta.demo_url,
                documentationUrl: "string",
                displayVersion: "string",
                releaseNotes: "string",
                status: "draft",
                relatedVariations: getRelatedVarations(options, themeConfig),
                configurationId: variationIndex + 1,
                defaultConfigurationId: variationIndex + 1,
                isCurrent: options.variationIndex === variationIndex
            },
            meta: variation.meta
        });
    };
};

function getRelatedVarations(options, themeConfig) {
    var currentVariationIndex = themeConfig.variationIndex;
    var relatedVariations = [];
    var variation;
    var screenshot;

    for (var index = 0; index < themeConfig.getVariationCount(); index++) {

        variation = themeConfig.getVariation(index);
        screenshot = getScreenshotUrl(options, variation.meta.desktop_screenshot);

        relatedVariations.push({
            id: index + 1,
            variationName: variation.name,
            screenshot: {
                largePreview: screenshot,
                largeThumb: screenshot,
                smallThumb: screenshot
            },
            configurationId: index + 1,
            isCurrent: options.variationIndex === index
        });
    };

    return relatedVariations;
}

function getScreenshotUrl(options, image) {
    var path = Path.join('meta',  image || '');
    return Url.resolve(options.themeEditorHost, path);
}
