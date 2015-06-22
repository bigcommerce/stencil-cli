var _ = require('lodash');

module.exports.parse = parse;

/**
 * Parses a theme config.json and pulls out the correct theme variation and settings based on the passed in name.
 *
 * @param configPath
 * @param variationName
 * @returns {{config: *, variation: *, settings: *}}
 */
function parse (configPath, variationName) {
    var variation,
        settings,
        config = require(configPath),
        configClone = _.clone(config, true);

    if (! _.isArray(configClone.variations) || configClone.variations.length === 0) {
        throw new Error('Your theme must have at least one variation in the config.json file.');
    }

    if (! variationName) {
        variation = configClone.variations[0];
        settings = variation.settings || {};
    } else {
        variation = _.find(configClone.variations, {
            name: variationName
        });

        if (! variation) {
            throw new Error(
                'Variation: ' +
                variationName +
                ' is not defined in the theme\'s config.json'
            );
        }

        settings = variation.settings || {};
    }

    // No need for all of the variations as we have the one
    delete configClone.variations;
    // We've already extracted the settings
    delete variation.settings;

    return {
        config: configClone,
        variation: variation,
        settings: settings
    };
}
