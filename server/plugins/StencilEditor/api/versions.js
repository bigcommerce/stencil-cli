var Path = require('path');
var Url = require('url');
var Fs = require('fs');
var Glob = require('glob');
var Async = require('async');
var _ = require('lodash');
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
                return reply(err);
            }

            reply({
                data: {
                    id: '1',
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
 * @param {Object}   schema
 * @param {Object}   options
 * @param {Function} callback
 */
internals.getThemeSchema = function (options, callback) {
    var schema = require(options.themeConfigSchemaPath);
    var forceReloadIds = {};

    function searchForThemeSettings(path, next) {
        var match;

        Fs.readFile(path, 'utf8', function(err, content) {
            if (err) {
                return next(err);
            }

            var pattern = /{{\s*theme_settings\.([^}}]+)}}/g;

            while (match = pattern.exec(content)) {
                forceReloadIds[match[1]] = true;
            }

            next();
        });
    };

    Glob(Path.join(options.themeTemplatesPath, '**/*.html'), function(err, files) {
        if (err) {
            return callback(err);
        }

        Async.map(files, searchForThemeSettings, function(err) {
            if (err) {
                return callback(err);
            }

            _.each(schema, function(data) {
                _.each(data.settings, function(item) {
                    if (forceReloadIds[item.id]) {
                        item['force_reload'] = true;
                    }
                })
            });

            callback(null, schema);
        });
    });
};

