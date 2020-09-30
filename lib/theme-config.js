const _ = require('lodash');
const fs = require('fs');
const Path = require('path');
const glob = require('glob');
const async = require('async');
const { parseJsonFile } = require('./utils/fsUtils');

class ThemeConfig {
    /**
     * ThemeConfig Class Constructor
     *
     * @param themePath
     * @constructor
     */
    constructor(themePath) {
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
    getConfig() {
        const config = this.getRawConfig();
        const variation = this._getVariation(config, this.variationIndex);

        this.globalSettings = _.cloneDeep(config.settings);

        if (!this.currentVariationSettings) {
            this.currentVariationSettings = variation.settings;
        }

        // Set some defaults
        config.css_compiler = config.css_compiler || 'scss';
        config.autoprefixer_cascade = config.autoprefixer_cascade || true;
        config.autoprefixer_browsers = config.autoprefixer_browsers || [
            '> 1%',
            'last 2 versions',
            'Firefox ESR',
        ];

        // Merge in the variation settings and images objects
        config.settings = _.defaultsDeep(this.currentVariationSettings, config.settings || {});
        config.images = _.defaultsDeep(variation.images, config.images || {});
        config.variationName = variation.name;

        return config;
    }

    /**
     * Updates the current variation settings
     *
     * @param newSettings
     * @param saveToFile
     * @returns {ThemeConfig}
     */
    updateConfig(newSettings, saveToFile) {
        let rawConfig;
        let variation;

        // Remove all variation settings that match theme's settings
        this.currentVariationSettings = _.omit(
            newSettings,
            (value, key) => this.globalSettings[key] === value,
            this,
        );

        if (saveToFile) {
            // Resetting the global settings so the only data saved to the file are the changes
            // from a specific variation's settings.
            rawConfig = this.getRawConfig();
            variation = this._getVariation(rawConfig, this.variationIndex);

            variation.settings = this.currentVariationSettings;

            fs.writeFileSync(this.configPath, JSON.stringify(rawConfig, null, 2), {
                encoding: 'utf-8',
            });
        }

        return this;
    }

    /**
     * Theme Path Setter
     *
     * @param themePath
     * @returns {ThemeConfig}
     */
    setThemePath(themePath) {
        this.themePath = themePath;
        this.configPath = Path.join(themePath, 'config.json');
        this.schemaPath = Path.join(themePath, 'schema.json');
        this.schemaTranslationsPath = Path.join(themePath, 'schemaTranslations.json');
        this.variationIndex = 0;

        return this;
    }

    /**
     * Reset Current Variation Settings
     *
     * @returns {ThemeConfig}
     */
    resetVariationSettings() {
        this.currentVariationSettings = null;
    }

    /**
     * Variation Name Setter
     *
     * @param variationIndex
     * @returns {ThemeConfig}
     */
    setVariation(variationIndex) {
        if (variationIndex !== this.variationIndex) {
            this.variationIndex = variationIndex;
            this.currentVariationSettings = null;
        }

        return this;
    }

    /**
     * Get variation object by index
     * @returns {Object}
     */
    getVariation(variationIndex) {
        return this._getVariation(this.getConfig(), variationIndex);
    }

    /**
     * Variation Name Setter
     *
     * @param variationName
     * @returns {ThemeConfig}
     */
    setVariationByName(variationName) {
        const config = this.getRawConfig();
        let variationIndex = 0;

        if (variationName) {
            variationIndex = config.variations.findIndex(
                (variation) => variation.name === variationName,
            );

            if (variationIndex === -1) {
                throw new Error(
                    `Variation: ${variationName} is not defined in the theme's config.json`,
                );
            }
        }

        this.variationIndex = variationIndex;
        this.currentVariationSettings = null;

        return this;
    }

    /**
     * Get theme meta object
     * @returns {Object}
     */
    getMeta() {
        return this.getConfig().meta || {};
    }

    /**
     * Get theme name
     * @returns {string}
     */
    getName() {
        return this.getConfig().name || '';
    }

    /**
     * Get theme version
     * @returns {string}
     */
    getVersion() {
        return this.getConfig().version || '';
    }

    /**
     * Get theme variation name
     * @returns {string}
     */
    getVariationName() {
        return this.getConfig().variationName || '';
    }

    /**
     * Get the number of variations
     * @returns {number}
     */
    getVariationCount() {
        const { variations } = this.getConfig();

        if (!Array.isArray(variations)) {
            return 0;
        }

        return variations.length;
    }

    /**
     * Check if the variation exists
     * @returns {boolean}
     */
    variationExists(variationIndex) {
        return _.inRange(variationIndex, 0, this.getVariationCount());
    }

    /**
     * Get theme price
     * @returns {number}
     */
    getPrice() {
        return this.getMeta().price || 0;
    }

    /**
     * Get theme composed image
     * @returns {string}
     */
    getComposedImage() {
        return this.getMeta().composed_image || '';
    }

    /**
     * Check if the config.json file exists
     * @returns {boolean}
     */
    configExists() {
        return fs.existsSync(this.configPath);
    }

    /**
     * Check if the schema.json file exists
     * @returns {boolean}
     */
    schemaExists() {
        return fs.existsSync(this.schemaPath);
    }

    /**
     * Check if the schemaTranslations.json file exists
     * @returns {boolean}
     */
    schemaTranslationsExists() {
        return fs.existsSync(this.schemaTranslationsPath);
    }

    /**
     * Scans the theme template directory for theme settings that need force reload
     *
     * @param {Function} callback
     */
    getSchema(callback) {
        let themeSchema;

        if (!fs.existsSync(this.schemaPath)) {
            callback(null, []);
            return;
        }

        try {
            themeSchema = parseJsonFile(this.schemaPath);
        } catch (err) {
            callback(err);
            return;
        }

        if (!Array.isArray(themeSchema)) {
            themeSchema = [];
        }

        glob(Path.join(this.themePath, 'templates/**/*.html'), (err, files) => {
            if (err) {
                callback(err);
                return;
            }

            async.map(files, this._fetchThemeSettings, (fetchingError, themeSettings) => {
                if (fetchingError) {
                    return callback(fetchingError);
                }

                const forceReloadIds = themeSettings.reduce(
                    (res, item) => ({ ...res, ...item }),
                    {},
                );

                for (const themeSchemaItem of themeSchema) {
                    for (const item of themeSchemaItem.settings) {
                        if (forceReloadIds[item.id]) {
                            item.force_reload = true;
                        }
                    }
                }

                return callback(null, themeSchema);
            });
        });
    }

    /**
     * Get Schema Translations
     *
     * @param {Function} callback
     */
    getSchemaTranslations(callback) {
        let schemaTranslations;

        if (!fs.existsSync(this.schemaTranslationsPath)) {
            callback(null, {});
            return;
        }

        try {
            schemaTranslations = parseJsonFile(this.schemaTranslationsPath);
        } catch (err) {
            callback(err);
            return;
        }

        if (!_.isObject(schemaTranslations)) {
            schemaTranslations = {};
        }

        callback(null, schemaTranslations);
    }

    /**
     * Return the raw config.json data
     *
     * @returns {object}
     */
    getRawConfig() {
        return parseJsonFile(this.configPath);
    }

    /**
     * Return the raw schema.json data
     *
     * @returns {object}
     */
    getRawSchema() {
        return parseJsonFile(this.schemaPath);
    }

    /**
     * Return the raw config.json data
     *
     * @returns {object}
     */
    getRawSchemaTranslations() {
        return parseJsonFile(this.schemaTranslationsPath);
    }

    /**
     * Grabs out a variation based on a name. Or if the name is not passed in, the very first one in the list.
     *
     * @private
     * @param config
     * @param variationIndex
     * @returns {object}
     */
    _getVariation(config, variationIndex) {
        let variation;

        if (!Array.isArray(config.variations) || config.variations.length === 0) {
            throw new Error('Your theme must have at least one variation in the config.json file.');
        }

        if (!variationIndex) {
            [variation] = config.variations;
        } else {
            variation = config.variations[variationIndex];

            if (!variation) {
                throw new Error(`Variation index: ${variationIndex} not found theme's config.json`);
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
     * Scan file for theme_settings.*
     * @private
     * @param  {string}   path
     * @param  {Function} callback
     */
    _fetchThemeSettings(path, callback) {
        const themeSettingsRegexPattern = /\Wtheme_settings\.(.+?)\W/g;
        const themeSettings = {};
        let match;
        let content;

        try {
            content = fs.readFileSync(path, 'utf8');
        } catch (err) {
            callback(err);
            return;
        }

        // eslint-disable-next-line
        while ((match = themeSettingsRegexPattern.exec(content))) {
            themeSettings[match[1]] = true;
        }

        callback(null, themeSettings);
    }
}

let themeConfigInstance;

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

module.exports = {
    getInstance,
};
