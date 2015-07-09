var Boom = require('boom'),
    CssAssembler = require('../../../lib/cssAssembler'),
    Hoek = require('hoek'),
    Path = require('path'),
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


module.exports.register.attributes = {
    name: 'CssCompiler',
    version: '0.0.1'
};

/**
 * CSS Compiler Handler.  This utilises the CSS Assembler to gather all of the CSS files and then the
 * StencilStyles plugin to compile them all.
 * @param request
 * @param reply
 */
internals.implementation = function (request, reply) {
    var themeConfig = request.app.themeConfig.getConfig(),
        compiler = themeConfig.css_compiler,
        fileParts = Path.parse(request.params.path),
        basePath = Path.join(internals.options.cssBasePath, compiler),
        pathToFile = Path.join(
            fileParts.dir,
            fileParts.name + '.' + compiler
        );

    CssAssembler.assemble(pathToFile, basePath, compiler, function(err, files) {
        request.server.plugins.StencilStyles.compile(compiler, {
            data: files[pathToFile],
            files: files,
            dest: Path.join('/assets/css', request.params.path),
            themeSettings: themeConfig.settings,
            autoprefixerOptions: {
                cascade: themeConfig.autoprefixer_cascade,
                browsers: themeConfig.autoprefixer_browsers
            }
        }, function (err, css) {
            if (err) {
                return reply(Boom.badData(err));
            }

            reply(css).type('text/css');
        });
    });
};
