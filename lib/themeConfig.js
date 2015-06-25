var _ = require('lodash'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Path = require('path');

module.exports = ThemeConfig;

function ThemeConfig (configPath, configSchemaPath, variationName) {
    this.configPath = configPath;
    this.variationName = variationName;
    this.configSchemaPath = configSchemaPath;
}

/**
 * Returns the full Theme Config.
 *
 * @returns {object}
 */
ThemeConfig.prototype.getConfig = function () {
    return getConfig(this.configPath, this.variationName);
};

ThemeConfig.prototype.updateConfig = function(newConfig) {
    return updateConfig(this.configPath, this.configSchemaPath, this.variationName, newConfig);
};

ThemeConfig.prototype.setVariant = function(variant) {
    this.variantName = variant.name;
};

/**
 * Grab the config JSON string, parse it into an object, grab the current variation,
 * and then merge it into the top level settings.
 *
 * @param configPath
 * @param variationName
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
    config.globalSettings = config.settings;
    // Merge in the variation settings and images objects
    config.settings = Hoek.applyToDefaults(config.settings || {}, variation.settings);
    config.images = Hoek.applyToDefaults(config.images || {}, variation.images);

    return config;
}
/**
 * Grab the config schema JSON string, parse it into an object, and return it
 *
 * @param configSchemaPath
 * @return {object}
 */
function getConfigSchema (configSchemaPath) {
    var rawConfigSchema = Fs.readFileSync(configSchemaPath, {encoding: 'utf-8'});

    return JSON.parse(rawConfigSchema);
}

/**
 * Updates a variation param in theme config based on passed in variation name
 *
 * @param configPath
 * @param configSchemaPath
 * @param variationName
 * @param newSettings
 * @return
 */
function updateConfig(configPath, configSchemaPath, variationName, newSettings) {
    var ret = {
            forceReload: false
        },
        config = getConfig(configPath),
        currentVariation = getVariation(config, variationName),
        changedSettings = _.pick(newSettings, function (val, key) {
            return currentVariation.settings[key] !== val;
        });

    _.extend(currentVariation.settings, newSettings);

    Fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {encoding: 'utf-8'});

    if (! _.isEmpty(changedSettings)) {
        changedSettings = _.pick(changedSettings, filterByForceReload(true, configSchemaPath));

        if (! _.isEmpty(changedSettings)) {
            ret.forceReload = true;
        }
    }

    return ret;
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

    if (! variation.settings) {
        variation.settings = {};
    }

    if (! variation.images) {
        variation.images = {};
    }

    return variation;
}

/**
 * Helper function to filter by forceReload
 *
 * @param which
 * @param configSchemaPath
 * @returns {Function}
 */
function filterByForceReload(which, configSchemaPath) {
    var configSchema = getConfigSchema(configSchemaPath);

    return function (val, key) {
        var okay = false;

        _.forEach(configSchema, function (chunk) {
            var forceReloadCheck = _.find(chunk.settings, {id: key});

            if (! forceReloadCheck) {
                return;
            }

            if (forceReloadCheck.force_reload === which) {
                okay = true;

                // We found what we were looking for, lets kick out of the _.forEach();
                return false;
            }
        });

        return okay;
    };
}
