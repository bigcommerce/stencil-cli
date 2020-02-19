var _ = require('lodash');
var Fs = require('fs');
var Hoek = require('hoek');
var Path = require('path');
var Glob = require('glob');
var Async = require('async');
var jsonLint = require('./json-lint');

var themeConfigInstance;

module.exports.getInstance = getInstance;

/**
 * Grabs the currently set instance or creates one if it doesn't exist.  If called
 * a second time with params, it will set those specific params and return the instance.
 *
 * @param themePath
 * @returns {ThemeConfig}
 */
function getInstance(themePath) {
    if (!themeConfigInstance) {
        themeConfigInstance = new ThemeConfig(themePath);

        return themeConfigInstance;
    }

    if (themePath) {
        themeConfigInstance.setThemePath(themePath);
    }

    return themeConfigInstance;
}

/**
 * ThemeConfig Class Constructor
 *
 * @param themePath
 * @constructor
 */
function ThemeConfig(themePath) {
    if (themePath) {
        this.setThemePath(themePath);
    }

    this.currentVariationSettings = null;
    this.globalSettings = null;
    this.variationIndex = 0;
}

/**
 * Grab the config JSON string, parse it into an object, grab the current variation,
 * and then merge it into the top level settings.
 *
 * @returns {object}
 */
ThemeConfig.prototype.getConfig = function () {
    var config = this.getRawConfig();
    var variation = getVariation(config, this.variationIndex);

    this.globalSettings = Hoek.clone(config.settings);

    if (!this.currentVariationSettings) {
        this.currentVariationSettings = variation.settings;
    }

    // Set some defaults
    config.css_compiler = config.css_compiler || 'scss';
    config.autoprefixer_cascade = config.autoprefixer_cascade || true;
    config.autoprefixer_browsers = config.autoprefixer_browsers || ['> 1%', 'last 2 versions', 'Firefox ESR'];

    // Merge in the variation settings and images objects
    config.settings = Hoek.applyToDefaults(config.settings || {}, this.currentVariationSettings);
    config.images = Hoek.applyToDefaults(config.images || {}, variation.images);
    config.variationName = variation.name;

    return config;
};

/**
 * Updates the current variation settings
 *
 * @param newSettings
 * @param saveToFile
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.updateConfig = function (newSettings, saveToFile) {
    var rawConfig;
    var variation;

    // Remove all variation settings that match theme's settings
    this.currentVariationSettings = _.omit(newSettings, function (value, key) {
        return this.globalSettings[key] === value;
    }, this);

    if (saveToFile) {
        // Resetting the global settings so the only data saved to the file are the changes
        // from a specific variation's settings.
        rawConfig = this.getRawConfig();
        variation = getVariation(rawConfig, this.variationIndex);

        variation.settings = this.currentVariationSettings;

        Fs.writeFileSync(this.configPath, JSON.stringify(rawConfig, null, 2), {encoding: 'utf-8'});
    }

    return this;
};

/**
 * Theme Path Setter
 *
 * @param themePath
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setThemePath = function (themePath) {
    this.themePath = themePath;
    this.configPath = Path.join(themePath, 'config.json');
    this.schemaPath = Path.join(themePath, 'schema.json');
    this.schemaTranslationsPath = Path.join(themePath, 'schemaTranslations.json');
    this.variationIndex = 0;

    return this;
};

/**
 * Variation Name Setter
 *
 * @param variationIndex
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setVariation = function (variationIndex) {

    if (variationIndex !== this.variationIndex) {
        this.variationIndex = variationIndex;
        this.currentVariationSettings = null;
    }

    return this;
};

/**
 * Get the current variation object
 * @return {Object}
 */
ThemeConfig.prototype.getCurrentVariation = function () {
    if (_.isNull(this.variationIndex)) {
        throw new Error('The current varation has not been set yet');
    }

    return getVariation(this.getConfig(), this.variationIndex);
};


/**
 * Get variation object by index
 * @return {Object}
 */
ThemeConfig.prototype.getVariation = function (variationIndex) {
    return getVariation(this.getConfig(), variationIndex);
};

/**
 * Variation Name Setter
 *
 * @param variationName
 * @returns {ThemeConfig}
 */
ThemeConfig.prototype.setVariationByName = function (variationName) {
    var config = this.getRawConfig();
    var variationIndex = 0;

    if (variationName) {
        variationIndex = _.findIndex(config.variations, function (variation) {
            return variation.name == variationName;
        });

        if (variationIndex === -1) {
            throw new Error(
                'Variation: ' +
                variationName +
                ' is not defined in the theme\'s config.json',
            );
        }
    }

    this.variationIndex = variationIndex;
    this.currentVariationSettings = null;

    return this;
};

/**
 * Get theme meta object
 * @return {Object}
 */
ThemeConfig.prototype.getMeta = function () {
    return this.getConfig().meta || {};
};

/**
 * Get theme name
 * @return {String}
 */
ThemeConfig.prototype.getName = function () {
    return this.getConfig().name || '';
};

/**
 * Get theme description
 * @return {String}
 */
ThemeConfig.prototype.getDescription = function () {
    return this.getConfig().description || '';
};

/**
 * Get theme version
 * @return {String}
 */
ThemeConfig.prototype.getVersion = function () {
    return this.getConfig().version || '';
};

/**
 * Get theme variation name
 * @return {String}
 */
ThemeConfig.prototype.getVariationName = function () {
    return this.getConfig().variationName || '';
};

/**
 * Get the number of variations
 * @return {Number}
 */
ThemeConfig.prototype.getVariationCount = function () {
    var variations = this.getConfig().variations;

    if (!_.isArray(variations)) {
        return 0;
    }

    return variations.length;
};

/**
 * Check if the variation exists
 * @return {Boolena}
 */
ThemeConfig.prototype.variationExists = function (variationIndex) {
    return _.inRange(variationIndex, 0, this.getVariationCount());
};

/**
 * Get theme price
 * @return {Number}
 */
ThemeConfig.prototype.getPrice = function () {
    return this.getMeta().price || 0;
};

/**
 * Get theme composed image
 * @return {String}
 */
ThemeConfig.prototype.getComposedImage = function () {
    return this.getMeta().composed_image || '';
};

/**
 * Get theme demo url
 * @return {String}
 */
ThemeConfig.prototype.getDemoUrl = function () {
    return this.getConfig().demoUrl || '';
};

/**
 * Check if the config.json file exists
 * @return {Boolean}
 */
ThemeConfig.prototype.configExists = function () {
    return fileExists(this.configPath);
};

/**
 * Check if the schema.json file exists
 * @return {Boolean}
 */
ThemeConfig.prototype.schemaExists = function () {
    return fileExists(this.schemaPath);
};

/**
 * Check if the schemaTranslations.json file exists
 * @return {Boolean}
 */
ThemeConfig.prototype.schemaTranslationsExists = function () {
    return fileExists(this.schemaTranslationsPath);
};

/**
 * Scans the theme template directory for theme settings that need force reload
 *
 * @param {Function} callback
 */
ThemeConfig.prototype.getSchema = function (callback) {
    var themeSchemaContent;
    var themeSchema;

    try {
        themeSchemaContent = Fs.readFileSync(this.schemaPath, {encoding: 'utf-8'});
    } catch (err) {
        return callback(null, []);
    }

    if (themeSchemaContent) {
        try {
            themeSchema = jsonLint.parse(themeSchemaContent, this.schemaPath);
        } catch (err) {
            return callback(err);
        }
    }

    if (!_.isArray(themeSchema)) {
        themeSchema = [];
    }

    Glob(Path.join(this.themePath, 'templates/**/*.html'), function (err, files) {
        if (err) {
            return callback(err);
        }

        Async.map(files, fetchThemeSettings, function (err, themeSettings) {
            var forceReloadIds = {};

            if (err) {
                return callback(err);
            }

            _.each(themeSettings, function (id) {
                forceReloadIds = _.merge(forceReloadIds, id);
            });

            _.each(themeSchema, function (data) {
                _.each(data.settings, function (item) {
                    if (forceReloadIds[item.id]) {
                        item['force_reload'] = true;
                    }
                });
            });

            return callback(null, themeSchema);
        });
    });
};

/**
 * Scan file for theme_settings.*
 * @param  {String}   path
 * @param  {Function} callback
 */
function fetchThemeSettings(path, callback) {
    var themeSettingsRegexPattern = /\Wtheme_settings\.(.+?)\W/g;
    var themeSettings = {};

    Fs.readFile(path, 'utf8', function (err, content) {
        var match;

        if (err) {
            return callback(err);
        }

        while (match = themeSettingsRegexPattern.exec(content)) {
            themeSettings[match[1]] = true;
        }

        return callback(null, themeSettings);
    });
};

/**
 * Get Schema Translations
 *
 * @param {Function} callback
 */
ThemeConfig.prototype.getSchemaTranslations = function(callback) {
    var schemaTranslationsContent;
    var schemaTranslations;

    try {
        schemaTranslationsContent = Fs.readFileSync(this.schemaTranslationsPath, {encoding: 'utf-8'});
    } catch (err) {
        return callback(null, {});
    }

    if (schemaTranslationsContent) {
        try {
            schemaTranslations = jsonLint.parse(schemaTranslationsContent, this.schemaTranslationsPath);
        } catch (err) {
            return callback(err);
        }
    }

    if (!_.isObject(schemaTranslations)) {
        schemaTranslations = {};
    }

    return callback(null, schemaTranslations);
};

/**
 * Return the raw config.json data
 *
 * @return {object}
 */
ThemeConfig.prototype.getRawConfig = function() {
    return jsonLint.parse(Fs.readFileSync(this.configPath, {encoding: 'utf-8'}), this.configPath);
};

/**
 * Return the raw schema.json data
 *
 * @return {object}
 */
ThemeConfig.prototype.getRawSchema = function() {
    return jsonLint.parse(Fs.readFileSync(this.schemaPath, {encoding: 'utf-8'}), this.schemaPath);
};

/**
 * Return the raw config.json data
 *
 * @return {object}
 */
ThemeConfig.prototype.getRawSchemaTranslations = function() {
    return jsonLint.parse(Fs.readFileSync(this.schemaTranslationsPath, {encoding: 'utf-8'}), this.schemaTranslationsPath);
};

/**
 * Grabs out a variation based on a name. Or if the name is not passed in, the very first one in the list.
 *
 * @param config
 * @param variationIndex
 * @returns {object}
 */
function getVariation(config, variationIndex) {
    var variation;

    if (! _.isArray(config.variations) || config.variations.length === 0) {
        throw new Error(
            'Your theme must have at least one variation in the config.json file.',
        );
    }

    if (! variationIndex) {
        variation = config.variations[0];
    } else {
        variation = config.variations[variationIndex];

        if (! variation) {
            throw new Error(
                'Variation index: ' + variationIndex + ' not found theme\'s config.json',
            );
        }
    }

    if (!_.isObject(variation.settings)) {
        variation.settings = {};
    }

    if (!_.isObject(variation.images)) {
        variation.images = {};
    }

    if (!_.isObject(variation.meta)) {
        variation.meta = {};
    }

    return variation;
}

/**
 * Check if file exist syncronous
 * @param  {string} path
 * @return {boolean}
 */
function fileExists(path) {
    try {
        return !!Fs.statSync(path);
    }
    catch (e) {
        return false;
    }
}
