var Async = require('async'),
    Frontmatter = require('front-matter'),
    Fs = require('fs'),
    Path = require('path'),
    _ = require('lodash'),
    Hoek = require('hoek'),
    internals = {
        options: {
            extension: '.html',
            partialRegex: /\{\{>\s*([_|\-|a-zA-Z0-9\/]+).*?}}/g
        }
    };

module.exports.assemble = assemble;

/**
 * Parses the passed in templates and resolves all of their partials as well as parses the very first templates
 * Frontmatter if it wasn't already passed in by the 'stencil-config' header.
 *
 * @param request
 * @param options
 * @param callback
 */
function assemble(request, options, callback) {
    var ret = {
            config: {},
            templates: {},
            translations: {}
        },
        templatesMissing = [],
        commonTemplates = [
            'components/products/options/date',
            'components/products/options/input-checkbox',
            'components/products/options/input-file',
            'components/products/options/input-numbers',
            'components/products/options/input-text',
            'components/products/options/set-radio',
            'components/products/options/set-rectangle',
            'components/products/options/set-select',
            'components/products/options/swatch',
            'components/products/options/textarea',

            'components/products/customizations/text',
            'components/products/customizations/checkbox',
            'components/products/customizations/file',
            'components/products/customizations/select',
            'components/products/customizations/textarea',

            'components/common/forms/text',
            'components/common/forms/password',
            'components/common/forms/select',
            'components/common/forms/checkbox',
            'components/common/forms/selectortext',
            'components/common/forms/date',
            'components/common/forms/number',
            'components/common/forms/radio',
            'components/common/forms/multiline',

            'components/faceted-search/facets/hierarchy',
            'components/faceted-search/facets/multi',
            'components/faceted-search/facets/range',
            'components/faceted-search/facets/rating'
        ],
        configSetByHeader = false;

    callback = Hoek.nextTick(callback);

    if (request.headers['stencil-config']) {
        configSetByHeader = true;
        try {
            ret.config = JSON.parse(request.headers['stencil-config']);
        } catch (e) {
            return callback(e);
        }
    }

    Async.parallel([
        function(callback) {
            Async.each(_.union(options.templates, commonTemplates), resolvePartials, function (err) {
                var frontmatter,
                    frontmatterRegex = /---\n(?:.|\s)*?\n---\n/g,
                    frontmatterMatch,
                    frontmatterContent,
                    rawTemplate;

                if (err) {
                    return callback(err);
                }

                if (templatesMissing.length > 0) {
                    return callback(new Error('The following template(s) are/is missing: \n' + templatesMissing.join('\n')));
                }

                if (! configSetByHeader) {
                    // We use the very first file in the list of templates to parse the frontmatter.
                    rawTemplate = ret.templates[options.templates[0]];
                    if (rawTemplate) {
                        frontmatterMatch = rawTemplate.match(frontmatterRegex);
                        if (frontmatterMatch !== null) {
                            frontmatterContent = frontmatterMatch[0];
                            // Interpolate theme settings for frontmatter
                            _.forOwn(options.themeSettings, function(val, key) {
                                var regex = '{{\\s*?theme_settings\\.' + key + '\\s*?}}';
                                frontmatterContent = frontmatterContent.replace(new RegExp(regex, 'g'), val);
                            });

                            rawTemplate = rawTemplate.replace(frontmatterRegex, frontmatterContent);
                        }

                        frontmatter = Frontmatter(rawTemplate);
                        // Set the config
                        ret.config = frontmatter.attributes;
                        // Replace the content of the first template with the content stripped of the frontmatter
                        ret.templates[options.templates[0]] = frontmatter.body;
                    }
                }

                callback();
            });
        },
        function (callback) {
            loadTranslations(function(err, compiledLocales) {
                if (err) {
                    return callback(err);
                }

                ret.translations = compiledLocales;
                callback();
            })
        }
    ], function(err) {
        if (err) {
            callback(err);
        }

        callback(null, ret);
    });

    function resolvePartials(templateFile, callback) {
        var file = 'templates/' + templateFile + internals.options.extension;

        Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
            var matches = [],
                match,
                partialPath;

            if (err) {
                templatesMissing.push(templateFile);
            } else {
                ret.templates[templateFile] = content;
                match = internals.options.partialRegex.exec(content);

                while (match !== null) {
                    partialPath = match[1];
                    if (! ret.templates[partialPath]) {
                        matches.push(partialPath);
                    }
                    match = internals.options.partialRegex.exec(content);
                }
            }

            Async.each(matches, resolvePartials, function (err) {
                if (err) {
                    return callback(err);
                }

                callback();
            });
        });
    }
}

/**
 * This function simply loads the files from the lang directory and puts them in an object where locale name is the key
 * and locale data is the value
 * @param callback
 */
function loadTranslations(callback) {
    var localeDirectory = 'lang';

    Fs.readdir(localeDirectory, function (err, localeFiles) {
        var localesToLoad = {};

        if (err) {
            return callback(err);
        }

        _.each(localeFiles, function (localeFile) {
            var localeName = Path.basename(localeFile, '.json');

            localesToLoad[localeName] = function (callback) {
                var localeFilePath = localeDirectory + '/' + localeFile;

                Fs.readFile(localeFilePath, 'utf-8', function (err, localeData) {

                    if (err) {
                        return callback(new Error('failed to load ' + localeFilePath));
                    }

                    callback(null, localeData);
                });
            };
        });

        Async.parallel(localesToLoad, function (err, loadedLocales) {
            callback(null, loadedLocales);
        });
    });
}
