var Async = require('async'),
    Frontmatter = require('front-matter'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Path = require('path'),
    internals = {
        options: {
            extension: '.html',
            partialRegex: /\{\{>\s*([_|\-|a-zA-Z0-9\/]+).*?}}/g
        }
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.method('assembler', internals.implementation);

    next();
};

module.exports.register.attributes = {
    name: 'Assembler',
    version: '0.0.1'
};

/**
 * Parses the main template and resolves all of it's partials as well as parses it's front-matter
 * It will then call the passed in callback with an object with two keys: config & templates
 * config is the parsed front-matter and config.json.
 * templates is an object that uses the key for the template path and the value as the template content
 *
 * @param mainTemplate
 * @param callback
 */
internals.implementation = function(mainTemplate, callback) {
    var templates = {},
        templatesMissing = [];

    callback = Hoek.nextTick(callback);

    if (!Fs.existsSync('config.json')) {
        return callback('The file config.json is missing in the root of the theme.');
    }

    resolvePartials(mainTemplate, function(err, mainContent) {
        var frontmatter = Frontmatter(mainContent),
            config = frontmatter.attributes,
            defaultConfig = Fs.readFileSync('config.json', {encoding: 'utf-8'});

        if (templatesMissing.length > 0) {
            return callback('The following template(s) are/is missing: \n' + templatesMissing.join('\n'))
        }

        try {
            defaultConfig = JSON.parse(defaultConfig);
        } catch (e) {
            return callback(e);
        }

        Hoek.merge(config, defaultConfig);
        // Replace main template content with just the body of frontmatter.
        templates[mainTemplate] = frontmatter.body;

        callback(null, {
            config: config,
            templates: templates
        });
    });

    function resolvePartials(templateFile, callback) {
        callback = Hoek.nextTick(callback);

        Fs.readFile(templateFile + internals.options.extension, {encoding: 'utf-8'}, function(err, content) {
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
                    matches.push(partialPath);
                    match = internals.options.partialRegex.exec(content);
                }
            }

            Async.map(matches, resolvePartials, function () {
                return callback(null, content);
            });
        });
    }
};

