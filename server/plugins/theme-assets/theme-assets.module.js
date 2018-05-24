const Boom = require('boom');
const CssAssembler = require('../../../lib/css-assembler');
const Fs = require('fs');
const Hoek = require('hoek');
const jsonLint = require('../../../lib/json-lint');
const Path = require('path');
const Pkg = require('../../../package.json');
const stencilToken = require('../../lib/stencil-token');
const StencilStyles = require('@bigcommerce/stencil-styles');
const Url = require('url');
const Utils = require('../../lib/utils');
const Wreck = require('wreck');
const internals = {
    options: {},
};

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    internals.stencilStyles = new StencilStyles();

    server.expose('cssHandler', internals.cssHandler);
    server.expose('assetHandler', internals.assetHandler);

    return next();
};

module.exports.register.attributes = {
    name: 'ThemeAssets',
    version: '0.0.1',
};

/**
 * Get the variation index from the "ConfigId" in the css filename
 * @param  {string} fileName
 * @return {number}
 */
internals.getVariationIndex = fileName => {
    const match = fileName.match(new RegExp(`.+-(${Utils.uuidRegExp})$`));

    return match ? Utils.uuid2int(match[1]) - 1 : 0;
};

/**
 * Get the original css file name
 * @param  {string} fileName
 * @return {string}
 */
internals.getOriginalFileName = fileName => {
    const match = fileName.match(new RegExp(`(.+)-${Utils.uuidRegExp}$`));

    return match ? match[1] : fileName;
};

/**
 * CSS Compiler Handler.  This utilises the CSS Assembler to gather all of the CSS files and then the
 * StencilStyles plugin to compile them all.
 * @param request
 * @param reply
 */
internals.cssHandler = function (request, reply) {
    const variationIndex = internals.getVariationIndex(request.params.fileName);

    if (!request.app.themeConfig.variationExists(variationIndex)) {
        return reply(Boom.notFound('Variation ' + (variationIndex + 1) + ' does not exist.'));
    }

    // Set the variation to get the right theme configuration
    request.app.themeConfig.setVariation(variationIndex);

    // Get the theme configuration
    const fileName = internals.getOriginalFileName(request.params.fileName);
    const fileParts = Path.parse(fileName);
    const pathToFile = Path.join(fileParts.dir, fileParts.name + '.scss');
    const basePath = Path.join(internals.getThemeAssetsPath(), 'scss');

    // Setup request to obtain CDN URL
    const staplerUrlObject = request.app.staplerUrl ? Url.parse(request.app.staplerUrl) : Url.parse(request.app.storeUrl);

    const httpOpts = {
        rejectUnauthorized: false,
        headers: internals.getHeaders(request, {
            get_data_only: true,
        }),
        payload: null,
    };
    httpOpts.headers.host = staplerUrlObject.host;
    httpOpts.headers.accept = 'text/html';

    const url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: '/',
    });

    Wreck.get(url, httpOpts, function (err, response, data) {
        var cdnUrl;

        try {
            data = JSON.parse(data);
            cdnUrl = data.context.settings.cdn_url;
        } catch (e) {
            cdnUrl = '';
        }

        CssAssembler.assemble(pathToFile, basePath, 'scss', (err, files) => {
            const configuration = request.app.themeConfig.getConfig();

            var params = {
                data: files[pathToFile],
                files: files,
                dest: Path.join('/assets/css', fileName),
                themeSettings: configuration.settings,
                cdnUrl: cdnUrl,
                sourceMap: true,
                autoprefixerOptions: {
                    cascade: configuration.autoprefixer_cascade,
                    browsers: configuration.autoprefixer_browsers,
                },
            };

            internals.stencilStyles.compileCss('scss', params, (err, css) => {
                if (err) {
                    console.error(err);
                    return reply(Boom.badData(err));
                }

                reply(css).type('text/css');
            });
        });
    });
};

/**
 * Assets handler
 *
 * @param request
 * @param reply
 */
internals.assetHandler = function (request, reply) {
    var filePath = Path.join(internals.getThemeAssetsPath(), request.params.fileName);

    reply.file(filePath);
};

internals.getThemeAssetsPath = () => {
    return Path.join(internals.options.themePath, 'assets');
};

internals.getHeaders = function (request, options) {
    var currentOptions = {},
        headers,
        dotStencilFile,
        dotStencilFilePath;

    options = options || {};

    try {
        dotStencilFilePath = Path.join(process.cwd(), '.stencil');
        dotStencilFile = Fs.readFileSync(dotStencilFilePath, {encoding: 'utf-8'});
        dotStencilFile = jsonLint.parse(dotStencilFile, dotStencilFilePath);
    } catch (e) {
        dotStencilFile = {};
    }

    headers = {
        'stencil-cli': Pkg.version,
        'stencil-version': Pkg.config.stencil_version,
        'stencil-options': JSON.stringify(Hoek.applyToDefaults(options, currentOptions)),
        'accept-encoding': 'identity',
    };

    if (dotStencilFile.clientId && dotStencilFile.accessToken) {
        headers['X-Auth-Client'] = dotStencilFile.clientId;
        headers['X-Auth-Token'] = dotStencilFile.accessToken;
    } else {
        headers['Authorization'] = 'Basic ' + stencilToken.generate(dotStencilFile.username, dotStencilFile.token);
    }

    if (request.app.staplerUrl) {
        headers['stencil-store-url'] = request.app.storeUrl;
    }

    return Hoek.applyToDefaults(request.headers, headers);
};
