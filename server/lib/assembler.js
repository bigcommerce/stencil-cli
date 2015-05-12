var Async = require('async'),
    Frontmatter = require('front-matter'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    internals = {
        options: {
            extension: '.html',
            partialRegex: /\{\{>\s*([_|\-|a-zA-Z0-9\/]+).*?}}/g
        }
    };

module.exports.assemble = assemble;

/**
 * Parses the main template and resolves all of it's partials as well as parses it's front-matter
 * It will then call the passed in callback with an object with two keys: config & templates
 * config is the parsed front-matter and config.json.
 * templates is an object that uses the key for the template path and the value as the template content
 *
 * @param mainTemplate
 * @param callback
 */
function assemble(mainTemplate, callback) {
    var templates = {},
        templatesMissing = [];

    callback = Hoek.nextTick(callback);

    if (!Fs.existsSync('config.json')) {
        return callback(new Error('The file config.json is missing in the root of the theme.'));
    }

    Async.parallel([
            //Load up all options templates, this is fine since it's devmode only
            function(cb) {
                Async.map([
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
                        'components/products/customizations/textarea'
                    ],
                    function(val, doneCallback) {
                        resolvePartials(val, doneCallback);
                    },
                    function (err, results) {
                        cb(err);
                    }
                )
            },
            function(cb) {
                resolvePartials(mainTemplate, function (err, mainContent) {
                    var frontmatter = Frontmatter(mainContent),
                        config = frontmatter.attributes,
                        defaultConfig = Fs.readFileSync('config.json', {encoding: 'utf-8'});

                    if (templatesMissing.length > 0) {
                        return callback(new Error('The following template(s) are/is missing: \n' + templatesMissing.join('\n')));
                    }

                    try {
                        defaultConfig = JSON.parse(defaultConfig);
                    } catch (e) {
                        return callback(e);
                    }

                    Hoek.merge(config, defaultConfig);
                    // Replace main template content with just the body of frontmatter.
                    templates[mainTemplate] = frontmatter.body;

                    cb(null, config);
                });
            }
        ],
        function (err, results) {
            var config = results[1];
            callback(null, {
                config: config,
                templates: templates
            });
        }
    );

    function resolvePartials(templateFile, callback) {
        callback = Hoek.nextTick(callback);

        Fs.readFile('templates/' + templateFile + internals.options.extension, {encoding: 'utf-8'}, function(err, content) {
            var matches = [],
                match,
                partialPath;

            if (err) {
                templatesMissing.push(templateFile);
            } else {
                templates[templateFile] = content;
                match = internals.options.partialRegex.exec(content);

                while (match != null) {
                    partialPath = match[1];
                    if (! templates[partialPath]) {
                        matches.push(partialPath);
                    }
                    match = internals.options.partialRegex.exec(content);
                }
            }

            Async.map(matches, resolvePartials, function () {
                return callback(null, content);
            });
        });
    }
}

