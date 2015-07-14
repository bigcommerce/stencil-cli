var _ = require('lodash'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Path = require('path');

module.exports = ThemeConfig;

function ThemeConfig (configPath, variationName) {
    this.configPath = configPath;
    this.variationName = variationName;
}

/**
 * Returns the full Theme Config.
 *
 * @returns {object}
 */
ThemeConfig.prototype.getConfig = function () {
    return getConfig(this.configPath, this.variationName);
};

/**
 * Grab the config JSON string, parse it into an object, grab the current variation,
 * and then merge it into the top level settings.
 *
 * @param configPath
 * @return {object}
 */
function getConfig (configPath, variationName) {
    var rawConfig = Fs.readFileSync(configPath, {encoding: 'utf-8'}),
        config = JSON.parse(rawConfig),
        variation = getVariation(config, variationName);

    // Set some defaults
    config.css_compiler = config.css_compiler || 'scss';
    config.autoprefixer_cascade = config.autoprefixer_cascade || true;
    config.autoprefixer_browsers = config.autoprefixer_browsers || ['> 5% in US'];
    // Add in actual variation name since the one passed in to the constructor could have been blank
    config.variationName = variation.name;
    // Merge in the variation settings and images objects
    config.settings = Hoek.applyToDefaults(config.settings || {}, variation.settings || {});
    config.images = Hoek.applyToDefaults(config.images || {}, variation.images || {});

    return config;
}

/**
 * Grabs out a variation based on a name. Or if the name is not passed in, the very first one in the list.
 *
 * @param config
 * @param variationName
 * @return {object}
 */
function getVariation(config, variationName) {
    var variation;

    if (! _.isArray(config.variations) || config.variations.length === 0) {
        throw new Error('Your theme must have at least one variation in the config.json file.');
    }

    if (! variationName) {
        variation = config.variations[0];
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
    }

    return variation;
}
