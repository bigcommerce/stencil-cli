var _ = require('lodash'),
    Fs = require('fs');

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
        rawConfig = Fs.readFileSync(configPath, {encoding: 'utf-8'}),
        config = JSON.parse(rawConfig);

    if (! _.isArray(config.variations) || config.variations.length === 0) {
        throw new Error('Your theme must have at least one variation in the config.json file.');
    }

    if (! variationName) {
        variation = config.variations[0];
        settings = variation.settings || {};
    } else {
        variation = _.find(config.variations, {
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
    delete config.variations;
    // We've already extracted the settings
    delete variation.settings;

    return {
        config: config,
        variation: variation,
        settings: settings
    };
}
