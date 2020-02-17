'use strict';

const _ = require('lodash');
const Async = require('async');
const Fs = require('graceful-fs');
const Path = require('path');
const Upath = require('upath');
const partialRegex = /\{\{>\s*([_|\-|a-zA-Z0-9\/]+)[^{]*?}}/g;
const dynamicComponentRegex = /\{\{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9\/]+)(?:'|").*?}}/g;

module.exports.partialRegex = partialRegex;
module.exports.dynamicComponentRegex = dynamicComponentRegex;
module.exports.assemble = assemble;
module.exports.assembleAndBundle = assembleAndBundle;
module.exports.getTemplateContentSync = getTemplateContentSync;

/**
 * Parses the passed in templates and resolves all of their partials.
 *
 * @param templatesFolder
 * @param options
 * @param templates
 * @param callback
 */
function assemble(templatesFolder, templates, callback) {
    getTemplatePaths(templatesFolder, templates, (err, templatePaths) => {
        if (err) {
            return callback(err);
        }

        getContent(templatesFolder, templatePaths, callback);
    });
}

/**
 * Parses the passed in template and resolves all of their partials for bundling
 * @param templatesFolder
 * @param templates
 * @param callback
 */
function assembleAndBundle(templatesFolder, templates, callback) {
    const options = { bundle: true };

    getTemplatePaths(templatesFolder, templates, options, (err, templatePaths) => {
        if (err) {
            return callback(err);
        }

        getContent(templatesFolder, templatePaths, callback);
    });
}

/**
 * Get template content
 * @param templatesFolder
 * @param templateFile
 */
function getTemplateContentSync(templatesFolder, templateFile) {
    const path = Path.join(templatesFolder, `${templateFile}.html`);
    return Fs.readFileSync(path).toString();
}

/**
 * Parses the passed in templates and returns all of the partials for each one
 *
 * @param templatesFolder
 * @param templates
 * @param options
 * @param callback
 */
function getTemplatePaths(templatesFolder, templates, options, callback) {
    if (typeof options === 'function') {
        callback = options;
    }

    let templatePaths = [];
    const missingTemplates = [];

    if (templates === undefined) {
        return callback(null);
    }

    if (! _.isArray(templates)) {
        templates = [templates];
    }

    Async.each(templates, resolvePartials, err => {
        if (err) {
            return callback(err);
        }

        if (missingTemplates.length > 0) {
            return callback(new Error(
                'The following template(s) are/is missing: \n' + missingTemplates.join('\n'),
            ));
        }
        if (options.bundle) {
            templatePaths = templatePaths.map(ele => Upath.toUnix(ele));
        }

        callback(null, templatePaths);
    });

    function resolvePartials(templateFile, callback) {
        const file = Path.join(templatesFolder, `${templateFile}.html`);

        Fs.readFile(file, {encoding: 'utf-8'}, (err, content) => {
            const componentPaths = [];
            let matches = [];

            if (err) {
                missingTemplates.push(templateFile);

                return callback();
            }

            templatePaths.push(templateFile);

            let match = partialRegex.exec(content);
            let partialPath;

            while (match !== null) {
                partialPath = match[1];
                if (templatePaths.indexOf(partialPath) === -1) {
                    matches.push(partialPath);
                }
                match = partialRegex.exec(content);
            }

            match = dynamicComponentRegex.exec(content);

            while (match !== null) {
                if (componentPaths.indexOf(match[1]) === -1) {
                    componentPaths.push(match[1]);
                }
                match = dynamicComponentRegex.exec(content);
            }

            Async.each(componentPaths, (componentPath, callback) => {
                Fs.readdir(Path.join(templatesFolder, componentPath), (err, files) => {
                    if (err) {
                        return callback(err);
                    }

                    matches = _.reduce(files, (acc, file) => {
                        // remove the extension
                        partialPath = Path.join(componentPath, Path.parse(file).name);
                        if (templatePaths.indexOf(partialPath) === -1) {
                            acc.push(partialPath);
                        }

                        return acc;
                    }, matches);

                    callback();
                });
            }, err => {
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
 * @param templatesFolder
 * @param templatePaths
 * @param callback
 */
function getContent(templatesFolder, templatePaths, callback) {
    Async.reduce(templatePaths, {}, (acc, templatePath, reduceCallback) => {
        const file = Path.join(templatesFolder, `${templatePath}.html`);
        Fs.readFile(file, {encoding: 'utf-8'}, (err, content) => {
            if (err) {
                return reduceCallback(err);
            }

            acc[templatePath] = content;

            reduceCallback(null, acc);
        });
    }, callback);
}
