var Path = require('path');
var Url = require('url');
var Fs = require('fs');
var Glob = require('glob');
var Async = require('async');
var _ = require('lodash');
var JsonLint = require('jsonlint');
var internals = {};

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
        var config = themeConfig.getConfig();

        internals.getThemeSchema(options, function(err, schema) {
            if (err) {
                return reply({
                    errors: [
                        {
                            type: 'parse_error',
                            title: 'Parse Error',
                            detail: err.message
                        }
                    ]
                });
            }

            if (schema.length === 0) {
                // Warn the user that there is no schema.jon file
                request.log("No schema.json found in the theme directory. " + options.themeSchemaPath);
            }

            reply({
                data: {
                    id: 'theme',
                    name: config.name,
                    price: config.meta.price,
                    displayVersion: config.version,
                    editorSchema: schema,
                    status: 'draft',
                    numVariations: config.variations.length,
                    defaultVariationId: '1',
                    screenshot: Url.resolve(options.themeEditorHost, Path.join('meta', config.meta.composed_image))
                },
                meta: config.meta
            });
        });
    };
};

/**
 * Scans the theme template directory for theme settings that need force reload
 * @param {Object}   options
 * @param {Function} callback
 */
internals.getThemeSchema = function (options, callback) {
    var themeSchemaContent;
    var themeSchema;

    try {
        themeSchemaContent = Fs.readFileSync(options.themeSchemaPath, 'utf8');
    } catch (err) {
        return callback(null, []);
    }

    if (themeSchemaContent) {
        try {
            themeSchema = JsonLint.parse(themeSchemaContent);
        } catch (err) {
            return callback(err);
        }
    }        

    if (!_.isArray(themeSchema)) {
        themeSchema = [];
    }

    Glob(Path.join(options.themeTemplatesPath, '**/*.html'), function(err, files) {
        if (err) {
            return callback(err);
        }

        Async.map(files, internals.fetchThemeSettings, function(err, themeSettings) {
            var forceReloadIds = {};

            if (err) {
                return callback(err);
            }

            _.each(themeSettings, function(id) {
                forceReloadIds = _.merge(forceReloadIds, id);
            });

            _.each(themeSchema, function(data) {
                _.each(data.settings, function(item) {
                    if (forceReloadIds[item.id]) {
                        item['force_reload'] = true;
                    }
                })
            });

            return callback(null, themeSchema);
        });
    });
};

/**
 * Scan file for theme_settings.*
 * @param  {String}   path
 * @param  {Function} next
 */
internals.fetchThemeSettings = function (path, next) {
    var themeSettingsRegexPattern = /\Wtheme_settings\.(.+?)\W/g;
    var themeSettings = {};

    Fs.readFile(path, 'utf8', function(err, content) {
        var match;

        if (err) {
            return next(err);
        }

        while (match = themeSettingsRegexPattern.exec(content)) {
            themeSettings[match[1]] = true;
        }

        return next(null, themeSettings);
    });
};

