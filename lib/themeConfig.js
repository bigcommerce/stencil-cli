var _ = require('lodash'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Path = require('path'),
    themeConfigInstance;

module.exports.getInstance = getInstance;

/**
 * Grabs the currently set instance or creates one if it doesn't exist.  If called
 * a second time with params, it will set those specific params and return the instance.
 *
 * @param configPath
 * @param schemaPath
 * @param variationName
 * @returns {ThemeConfig}
 */
function getInstance(configPath, schemaPath, variationName) {
    if (!themeConfigInstance) {
        themeConfigInstance = new ThemeConfig(configPath, schemaPath, variationName);

        return themeConfigInstance;
    }

    if (configPath) {
        themeConfigInstance.setConfigPath(configPath);
    }

    if (schemaPath) {
        themeConfigInstance.setSchemaPath(schemaPath);
    }

    if (variationName) {
        themeConfigInstance.setVariationName(variationName);
    }

    return themeConfigInstance;
}

/**
 * ThemeConfig Class Constructor
 *
 * @param configPath
 * @param schemaPath
 * @param variationName
 * @constructor
 */
function ThemeConfig(configPath, schemaPath, variationName) {
    this.configPath = configPath;
    this.schemaPath = schemaPath;
    this.variationName = variationName;
}

/**
 * Returns the full Theme Config.
 *
 * @returns {object}
 */
ThemeConfig.prototype.getConfig = function() {
    return getConfig(this.configPath, this.variationName);
};

/**
 * Updates the config.json and returns a boolean based on if the browser should do a
 * hard reload or not.
 *
 * @param newConfig
 * @returns Boolean
 */
ThemeConfig.prototype.updateConfig = function(newConfig) {
    return updateConfig(this.configPath, this.schemaPath, this.variationName, newConfig);
};

/**
 * Config Path Setter
 *
 * @param configPath
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setConfigPath = function(configPath) {
    this.configPath = configPath;

    return this;
};

/**
 * Schema Path Setter
 *
 * @param schemaPath
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setSchemaPath = function(schemaPath) {
    this.schemaPath = schemaPath;

    return this;
};

/**
 * Variation Name Setter
 *
 * @param variationName
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setVariationName = function(variationName) {
    this.variationName = variationName;

    return this;
};

/**
 * Pass in an array of setting keys which will be compared against the
 * schema to see if any of them need to be force-reloaded.
 *
 * @param settingKeys
 * @returns Boolean
 */
ThemeConfig.prototype.checkForceReload = function(settingKeys) {
    return _.some(settingKeys, needForceReloaded(this.schemaPath));
};

/**
 * Grab the config JSON string, parse it into an object, grab the current variation,
 * and then merge it into the top level settings.
 *
 * @param configPath
 * @param variationName
 * @returns {object}
 */
function getConfig(configPath, variationName) {
    var rawConfig = Fs.readFileSync(configPath, {encoding: 'utf-8'}),
        config = JSON.parse(rawConfig),
        variation = getVariation(config, variationName);

    // Set some defaults
    config.css_compiler = config.css_compiler || 'scss';
    config.autoprefixer_cascade = config.autoprefixer_cascade || true;
    config.autoprefixer_browsers = config.autoprefixer_browsers || ['> 5% in US'];
    // Add in actual variation name since the one passed in to the constructor could have been blank
    config.variationName = variation.name;
    // This will be used to make sure the settings being saved will not be doubled up in the variation
    // settings if the values match
    config.globalSettings = config.settings;
    // Merge in the variation settings and images objects
    config.settings = Hoek.applyToDefaults(config.settings || {}, variation.settings);
    config.images = Hoek.applyToDefaults(config.images || {}, variation.images);

    return config;
}
/**
 * Grab the schema JSON string, parse it into an object, and return it
 *
 * @param schemaPath
 * @returns {object}
 */
function getSchema(schemaPath) {
    var rawConfigSchema = Fs.readFileSync(schemaPath, {encoding: 'utf-8'});

    return JSON.parse(rawConfigSchema);
}

/**
 * Updates a variation param in theme config based on passed in variation name
 *
 * @param configPath
 * @param schemaPath
 * @param variationName
 * @param newSettings
 * @return
 */
function updateConfig(configPath, schemaPath, variationName, newSettings) {
    var ret = {
            forceReload: false
        },
        config = getConfig(configPath),
        currentVariation = getVariation(config, variationName),
        changedSettings = _.pick(newSettings, function(val, key) {
            return currentVariation.settings[key] !== val;
        });

    _.extend(currentVariation.settings, newSettings);

    Fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {encoding: 'utf-8'});

    if (! _.isEmpty(changedSettings)) {
        ret.forceReload = _.some(_.keys(changedSettings), needForceReloaded(schemaPath));
    }

    return ret;
}

/**
 * Grabs out a variation based on a name. Or if the name is not passed in, the very first one in the list.
 *
 * @param config
 * @param variationName
 * @returns {object}
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
 * Helper function to see if some setting names need force-reloading.
 *
 * @param schemaPath
 * @returns {Function}
 */
function needForceReloaded(schemaPath) {
    var configSchema = getSchema(schemaPath);

    return function(key) {
        var okay = false;

        _.forEach(configSchema, function(chunk) {
            var forceReloadCheck = _.find(chunk.settings, {id: key});

            if (! forceReloadCheck) {
                return;
            }

            if (forceReloadCheck.force_reload === true) {
                okay = true;

                // We found what we were looking for, lets kick out of the _.forEach();
                return false;
            }
        });

        return okay;
    };
}
