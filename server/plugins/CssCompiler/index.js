var _ = require('lodash'),
    Autoprefixer = require('autoprefixer-core'),
    Boom = require('boom'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Less = require('less'),
    Path = require('path'),
    Sass = require('node-sass'),
    ThemeConfig = require('../../lib/themeConfig'),
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
    var themeConfig = request.app.themeConfig.getConfig(),
        compiler = themeConfig.css_compiler,
        fileParts = Path.parse(request.params.path),
        pathToFile = Path.join(
            internals.options.cssBasePath,
            compiler,
            fileParts.dir,
            fileParts.name + '.' + compiler
        ),
        autoprefixerOptions = {
            cascade: themeConfig.autoprefixer_cascade,
            browsers: themeConfig.autoprefixer_browsers
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
            themeSettings: themeConfig.settings
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
    var themeVariables = '',
        sassFunctions = {};

    Fs.readFile(options.file, {encoding: 'utf-8'}, function (err, content) {
        if (err) {
            return callback(err);
        }

        sassFunctions['stencilNumber($name, $unit: px)'] = function(nameObj, unitObj) {
            var name = nameObj.getValue(),
                unit = unitObj.getValue(),
                ret;

            if (options.themeSettings[name]) {
                ret = new Sass.types.Number(options.themeSettings[name], unit);
            } else {
                ret = Sass.NULL;
            }

            return ret;
        };

        sassFunctions['stencilColor($name)'] = function(nameObj) {
            var name = nameObj.getValue(),
                val,
                ret;

            if (options.themeSettings[name]) {
                val = options.themeSettings[name];

                if (val[0] === '#') {
                    val = val.substr(1);
                }

                ret = new Sass.types.Color(parseInt('0xff' + val, 16));
            } else {
                ret = Sass.NULL;
            }

            return ret;
        };

        sassFunctions['stencilString($name)'] = function(nameObj) {
            var name = nameObj.getValue(),
                ret;

            if (options.themeSettings[name]) {
                ret = new Sass.types.String(options.themeSettings[name]);
            } else {
                ret = Sass.NULL;
            }

            return ret;
        };

        Sass.render({
            file: options.file,
            functions: sassFunctions,
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
