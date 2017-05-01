var _ = require('lodash'),
    Async = require('async'),
    Fs = require('fs'),
    Path = require('path'),
    Upath = require('upath'),
    internals = {
        options: {
            templatesFolder: Path.join(process.cwd(), 'templates'),
            extension: '.html',
            partialRegex: /\{\{>\s*([_|\-|a-zA-Z0-9\/]+)[^{]*?}}/g,
            dynamicComponentRegex: /\{\{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9\/]+)(?:'|").*?}}/g,
        },
    };

module.exports.assemble = assemble;
module.exports.assembleAndBundle = assembleAndBundle;
module.exports.getTemplateContentSync = getTemplateContentSync;

/**
 * Parses the passed in templates and resolves all of their partials.
 *
 * @param options
 * @param templates
 * @param callback
 */
function assemble(templates, callback) {
    getTemplatePaths(templates, function(err, templatePaths) {
        if (err) {
            return callback(err);
        }

        getContent(templatePaths, callback);
    });
}

/**
 * Parses the passed in template and resolves all of their partials for bundling
 * @param templates
 * @param callback
 */
function assembleAndBundle(templates, callback) {
    var options = {
        bundle: true,
    };

    getTemplatePaths(templates, options, function(err, templatePaths) {
        if (err) {
            return callback(err);
        }

        getContent(templatePaths, callback);
    });
}

function getTemplateContentSync(templateFile) {
    var path = Path.join(internals.options.templatesFolder, templateFile + internals.options.extension);
    return Fs.readFileSync(path).toString();
}

/**
 * Parses the passed in templates and returns all of the partials for each one
 *
 * @param templates
 * @param options
 * @param callback
 */
function getTemplatePaths(templates, options, callback) {
    if (typeof options === 'function') {
        callback = options;
    }

    var templatePaths = [],
        missingTemplates = [];

    if (templates === undefined) {
        return callback(null);
    }

    if (! _.isArray(templates)) {
        templates = [templates];
    }

    Async.each(templates, resolvePartials, function (err) {
        if (err) {
            return callback(err);
        }

        if (missingTemplates.length > 0) {
            return callback(new Error(
                'The following template(s) are/is missing: \n' + missingTemplates.join('\n')
            ));
        }
        if (options.bundle) {
            templatePaths = templatePaths.map(function(ele) {
                return Upath.toUnix(ele);
            });
        }

        callback(null, templatePaths);
    });

    function resolvePartials(templateFile, callback) {
        var file = Path.join(internals.options.templatesFolder, templateFile + internals.options.extension);

        Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
            var componentPaths = [],
                matches = [],
                match,
                partialPath;

            if (err) {
                missingTemplates.push(templateFile);

                return callback();
            }

            templatePaths.push(templateFile);
            match = internals.options.partialRegex.exec(content);
            while (match !== null) {
                partialPath = match[1];
                if (templatePaths.indexOf(partialPath) === -1) {
                    matches.push(partialPath);
                }
                match = internals.options.partialRegex.exec(content);
            }

            match = internals.options.dynamicComponentRegex.exec(content);

            while (match !== null) {
                if (componentPaths.indexOf(match[1]) === -1) {
                    componentPaths.push(match[1]);
                }
                match = internals.options.dynamicComponentRegex.exec(content);
            }

            Async.each(componentPaths, function(componentPath, callback) {
                Fs.readdir(Path.join(internals.options.templatesFolder, componentPath), function(err, files) {
                    if (err) {
                        return callback(err);
                    }

                    matches = _.reduce(files, function(acc, file) {
                        // remove the extension
                        partialPath = Path.join(componentPath, Path.parse(file).name);
                        if (templatePaths.indexOf(partialPath) === -1) {
                            acc.push(partialPath);
                        }

                        return acc;
                    }, matches);

                    callback();
                });
            }, function(err) {
                if (err) {
                    return callback(err);
                }

                Async.each(matches, resolvePartials, callback);
            });
        });
    }
}

/**
 * Takes a list of templates and grabs their content. It returns simple key/val pair
 * of filename => content
 *
 * @param templatePaths
 * @param callback
 */
function getContent(templatePaths, callback) {
    Async.reduce(templatePaths, {}, getContentReducer, callback);

    function getContentReducer(acc, templatePath, reduceCallback) {
        var file = Path.join(internals.options.templatesFolder, templatePath + internals.options.extension);
        Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
            if (err) {
                return reduceCallback(err);
            }

            acc[templatePath] = content;

            reduceCallback(null, acc);
        });
    }
}
