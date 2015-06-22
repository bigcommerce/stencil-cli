var _ = require('lodash'),
    Autoprefixer = require('autoprefixer-core'),
    Boom = require('boom'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Less = require('less'),
    Path = require('path'),
    Sass = require('node-sass'),
    internals = {
        options: {
            cssBasePath: ''
        }
    };

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.expose('implementation', internals.implementation);

    return next();
};

/**
 *
 * @param request
 * @param reply
 */
internals.implementation = function (request, reply) {
    var compiler = request.app.themeConfig.css_compiler,
        fileParts = Path.parse(request.params.path),
        pathToFile = Path.join(
            internals.options.cssBasePath,
            compiler,
            fileParts.dir,
            fileParts.name + '.' + compiler
        ),
        autoprefixerOptions = {
            cascade: request.app.themeConfig.autoprefixer_cascade,
            browsers: request.app.themeConfig.autoprefixer_browsers
        },
        autoprefixerProcessor = Autoprefixer(autoprefixerOptions);

    Fs.exists(pathToFile, function (exists) {
        if (! exists) {
            return reply(Boom.notFound());
        }

        internals.compileCss(compiler, {
            file: pathToFile,
            includePaths: [Path.dirname(pathToFile)],
            dest: Path.join(internals.options.cssBasePath, 'css', request.params.path),
            themeSettings: request.app.themeSettings
        }, function (err, css) {
            if (err) {
                return reply(Boom.badData(err));
            }

            css = autoprefixerProcessor.process(css).css;

            reply(css).type('text/css');
        });
    });
};

module.exports.register.attributes = {
    name: 'CssCompiler',
    version: '0.0.1'
};

/**
 * Compiles the CSS based on which compiler has been specified
 *
 * @param compiler
 * @param options
 * @param callback
 */
internals.compileCss = function (compiler, options, callback) {
    switch(compiler) {
        case 'scss':
            internals.scssCompiler(options, callback);
            break;
        case 'less':
            internals.lessCompiler(options, callback);
            break;
    }
};

/**
 * Compile SCSS into CSS and return the content
 *
 * @param options
 * @param callback
 */
internals.scssCompiler = function (options, callback) {
    var themeVariables = '';

    Fs.readFile(options.file, {encoding: 'utf-8'}, function (err, content) {
        if (err) {
            return callback(err);
        }

        _.forOwn(options.themeSettings, function(val, key) {
            themeVariables += '$themeSetting-' + key + ': ' + val + ';\n';
        });

        Sass.render({
            file: options.file,
            data: themeVariables + content,
            includePaths: [options.includePaths],
            outFile: options.dest,
            sourceMap: true,
            sourceMapEmbed: true
        }, function (err, result) {
            if (err) {
                return callback('SASS Error: ' + err.message + ' at ' + (err.file + '@' + err.line + ':' + err.column));
            }

            callback(null, result.css);
        });
    });
};

/**
 * Compile LESS into CSS and return the content
 *
 * @param options
 * @param callback
 */
internals.lessCompiler = function (options, callback) {
    var themeVariables = '',
        lessOptions = {
            filename: options.file,
            compress: false,
            sourceMap: {
                sourceMapFileInline: true
            }
        };


    Fs.readFile(options.file, {encoding: 'utf-8'}, function (err, content) {
        if (err) {
            return callback(err);
        }

        _.forOwn(options.themeSettings, function(val, key) {
            themeVariables += '@themeSetting-' + key + ': ' + val + ';\n';
        });

        Less.render(themeVariables + content, lessOptions).then(function(result) {
            callback(null, result.css);
        }, function(err) {
            callback('LESS Error: ' + err.message + ' at ' + (err.filename + '@' + err.line + ':' + err.column));
        });
    });
};
