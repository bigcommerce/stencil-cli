var _ = require('lodash'),
    Assembler = require('../../lib/assembler'),
    Boom = require('boom'),
    FetchData = require('../../lib/fetchData'),
    Hoek = require('hoek'),
    Paper = require('stencil-paper'),
    Url = require('url'),
    internals = {
        options: {}
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.expose('implementation', internals.implementation);

    next();
};

module.exports.register.attributes = {
    name: 'Renderer',
    version: '0.0.1'
};

/**
 * Renderer Route Handler
 *
 * @param request
 * @param reply
 */
internals.implementation = function (request, reply) {
    var options = {get_template_file: true};

    FetchData.fetch(request, {options: options}, function (err, response) {
        var redirectPath,
            redirectUrl,
            templateName,
            replyResponse,
            cookies;

        if (err) {
            return reply(Boom.wrap(err));
        }

        if (response.redirect) {
            redirectPath = Url.parse(response.redirect).path;

            if (redirectPath.charAt(0) !== '/') {
                redirectPath = '/' + redirectPath;
            }

            redirectUrl = request.server.info.uri + redirectPath;

            replyResponse = reply.redirect(redirectUrl);

            cookies = internals.fixCookies(response.headers['set-cookie']);
            replyResponse.header('set-cookie', cookies);
            replyResponse.statusCode = response.statusCode;
        } else if (response.rawData) {
            replyResponse = reply(response.rawData);

            cookies = internals.fixCookies(response.headers['set-cookie']);
            replyResponse.header('set-cookie', cookies);
            replyResponse.statusCode = response.statusCode;
        } else {
            templateName = response.template_file;

            Assembler.assemble(templateName, function(err, templateData) {
                FetchData.fetch(request, {config: templateData.config}, function (err, bcAppData) {
                    var content;

                    if (err) {
                        return reply(Boom.wrap(err));
                    }

                    content = Paper.compile(templateName, templateData.templates, bcAppData.context);
                    content = internals.decorateOutput(content, request, bcAppData);

                    replyResponse = reply(content);

                    cookies = internals.fixCookies(bcAppData.headers['set-cookie']);
                    replyResponse.header('set-cookie', cookies);
                    replyResponse.statusCode = response.statusCode;
                });
            });
        }
    });
};


/**
 * Strip domain from cookies so they will work locally
 *
 * @param cookies
 */
internals.fixCookies = function(cookies) {
    var fixedCookies = [];

    _.each(cookies, function(cookie) {
        fixedCookies.push(cookie.replace(/domain=(.+);?/, ''));
    });

    return fixedCookies;
};

/**
 * Output post-processing
 *
 * @param content
 * @param request
 * @param data
 */
internals.decorateOutput = function (content, request, data) {
    var regex;

    regex = new RegExp(internals.escapeRegex(data.context.settings.base_url), 'g');
    content = content.replace(regex, '');

    regex = new RegExp(internals.escapeRegex(data.context.settings.secure_base_url), 'g');
    content = content.replace(regex, '');

    if (request.query.debug === 'bar') {
        var debugBar = '<pre><p><b>Context:</b></p>' + JSON.stringify(data.context, null, 2) + '</pre>';
        regex = new RegExp('</body>');
        content = content.replace(regex, debugBar + '\n</body>');
    }

    return content;
};

/**
 * Scape special characters for regular expression
 *
 * @param string
 */
internals.escapeRegex = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};
