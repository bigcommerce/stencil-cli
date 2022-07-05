const _ = require('lodash');
const async = require('async');
const fs = require('graceful-fs');
const path = require('path');
const upath = require('upath');

const partialRegex = /\{\{>\s*([_|\-|a-zA-Z0-9@'"/]+)[^{]*?}}/g;
const dynamicComponentRegex = /\{\{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9/]+)(?:'|").*?}}/g;
const includeRegex = /{{2}>\s*([_|\-|a-zA-Z0-9/]+)[^{]*?}{2}/g;
const pathStringRegex = /^["'].+["']$/;
const packageMarker = 'external/';

/**
 * indicates if a template source is a node modules dependency
 *
 * @param {string} templateName
 * @returns {Boolean}
 */
const isExternalTemplate = (templateName) => {
    return templateName.startsWith(packageMarker);
};
const defineBaseRoute = (route) => route.split('/').slice(0, 3).join('/');
const applyExternalPath = (templateName, templates) => {
    return templates.map((t) => `${defineBaseRoute(templateName)}/${t}`);
};
const replacePartialNames = (content, partialRoute) => {
    return content.replace(
        includeRegex,
        (__, partialName) => `{{> ${defineBaseRoute(partialRoute)}/${partialName} }}`,
    );
};
const trimPartial = (partial) => {
    if (pathStringRegex.test(partial)) {
        return partial.slice(1, -1);
    }
    return partial;
};

/**
 * Takes a templates folder and template name. It returns simple path for custom template if it's available
 *  or use default folder instead
 *
 * @param {string} templatesFolder
 * @param {string} templateName
 */
function getCustomPath(templatesFolder, templateName) {
    let customTemplatesDir;
    let customTemplateName;

    if (templateName.startsWith(packageMarker)) {
        customTemplatesDir = templatesFolder.replace('templates', 'node_modules');
        customTemplateName = templateName.slice(packageMarker.length);
    } else {
        customTemplatesDir = templatesFolder;
        customTemplateName = templateName;
    }

    return path.join(customTemplatesDir, `${customTemplateName}.html`);
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
    async.reduce(
        templatePaths,
        {},
        (acc, templatePath, reduceCallback) => {
            const file = getCustomPath(templatesFolder, templatePath);

            fs.readFile(file, { encoding: 'utf-8' }, (err, content) => {
                if (err) {
                    reduceCallback(err);
                    return;
                }

                acc[templatePath] = templatePath.startsWith(packageMarker)
                    ? replacePartialNames(content, templatePath)
                    : content;

                reduceCallback(null, acc);
            });
        },
        callback,
    );
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
        // eslint-disable-next-line no-param-reassign
        callback = options;
    }

    let templatePaths = [];
    const missingTemplates = [];

    if (!templates) {
        callback(null);
        return;
    }

    const normalizedTemplates = Array.isArray(templates) ? templates : [templates];

    // eslint-disable-next-line no-use-before-define
    async.each(normalizedTemplates, resolvePartials, (err) => {
        if (err) {
            return callback(err);
        }

        if (missingTemplates.length > 0) {
            return callback(
                new Error(
                    `The following template(s) are/is missing: \n${missingTemplates.join('\n')}`,
                ),
            );
        }
        if (options.bundle) {
            templatePaths = templatePaths.map((ele) => upath.toUnix(ele));
        }

        return callback(null, templatePaths);
    });

    function resolvePartials(t, cb2) {
        const templateName = trimPartial(t);
        const templatePath = getCustomPath(templatesFolder, templateName);

        fs.readFile(templatePath, { encoding: 'utf-8' }, (err, content) => {
            const componentPaths = [];
            let matches = [];

            if (err) {
                missingTemplates.push(templateName);
                cb2();
                return;
            }

            templatePaths.push(templateName);

            let match = partialRegex.exec(content);
            let partialPath;

            while (match !== null) {
                [, partialPath] = match;
                if (!templatePaths.includes(partialPath)) {
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

            async.each(
                componentPaths,
                (componentPath, cb3) => {
                    fs.readdir(path.join(templatesFolder, componentPath), (err3, files) => {
                        if (err3) {
                            cb3(err3);
                            return;
                        }

                        matches = _.reduce(
                            files,
                            (acc, file) => {
                                // remove the extension
                                partialPath = path.join(componentPath, path.parse(file).name);
                                if (templatePaths.indexOf(partialPath) === -1) {
                                    acc.push(partialPath);
                                }

                                return acc;
                            },
                            matches,
                        );

                        cb3();
                    });
                },
                (err2) => {
                    if (err2) {
                        cb2(err2);
                        return;
                    }

                    if (isExternalTemplate(templateName)) {
                        matches = applyExternalPath(templateName, matches);
                    }

                    async.each(matches, resolvePartials, cb2);
                },
            );
        });
    }
}

/**
 * Parses the passed in templates and resolves all of their partials.
 *
 * @param templatesFolder
 * @param templates
 * @param callback
 */
function assemble(templatesFolder, templates, callback) {
    getTemplatePaths(templatesFolder, templates, (err, templatePaths) => {
        if (err) {
            callback(err);
            return;
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
            callback(err);
            return;
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
    const templatePath = path.join(templatesFolder, `${templateFile}.html`);
    return fs.readFileSync(templatePath).toString();
}

module.exports = {
    partialRegex,
    dynamicComponentRegex,
    assemble,
    assembleAndBundle,
    getTemplateContentSync,
};
