var _ = require('lodash'),
    Async = require('async'),
    Fs = require('fs'),
    Path = require('path'),
    internals = {
        options: {
            extension: '.html',
            partialRegex: /\{\{>\s*([_|\-|a-zA-Z0-9\/]+).*?}}/g
        }
    };

module.exports.assemble = assemble;

/**
 * Parses the passed in templates and resolves all of their partials.
 *
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
 * Parses the passed in templates and returns all of the partials for each one
 *
 * @param templates
 * @param callback
 */
function getTemplatePaths(templates, callback) {
    var templatePaths = [],
        missingTemplates = [];

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

        callback(null, templatePaths);
    });

    function resolvePartials(templateFile, callback) {
        var file = 'templates/' + templateFile + internals.options.extension;

        Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
            var matches = [],
                match,
                partialPath;

            if (err) {
                missingTemplates.push(templateFile);
            } else {
                templatePaths.push(templateFile);
                match = internals.options.partialRegex.exec(content);

                while (match !== null) {
                    partialPath = match[1];
                    if (templatePaths.indexOf(partialPath) === -1) {
                        matches.push(partialPath);
                    }
                    match = internals.options.partialRegex.exec(content);
                }
            }

            Async.each(matches, resolvePartials, callback);
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
        var file = 'templates/' + templatePath + internals.options.extension;
        Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
            if (err) {
                return reduceCallback(err);
            }

            acc[templatePath] = content;

            reduceCallback(null, acc);
        });
    }
}
