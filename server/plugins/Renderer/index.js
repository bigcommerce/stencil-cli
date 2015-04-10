var Assembler = require('../../lib/assembler'),
    Boom = require('boom'),
    FetchData = require('../../lib/fetchData'),
    Hoek = require('hoek'),
    Paper = require('stencil-paper'),
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
        var templateName,
            replyResponse;

        if (err) {
            return reply(Boom.wrap(err));
        }

        if (response.headers.location) {
            replyResponse = reply.redirect(response.headers.location);

            if (response.headers['set-cookie']) {
                replyResponse.header('set-cookie', response.headers['set-cookie']);
            }

            replyResponse.code(response.statusCode);
        } else if (response.rawData) {
            replyResponse = reply(response.rawData);

            if (response.headers['set-cookie']) {
                replyResponse.header('set-cookie', response.headers['set-cookie']);
            }

            if (response.headers['content-type']) {
                replyResponse.type(response.headers['content-type']);
            }

            replyResponse.code(response.statusCode);
        } else {
            templateName = response.template_file;

            Assembler.assemble(templateName, function(err, templateData) {
                if (err) {
                    return reply(Boom.wrap(err));
                }

                FetchData.fetch(request, {config: templateData.config}, function (err, bcAppData) {
                    var content;

                    if (err) {
                        return reply(Boom.wrap(err));
                    }

                    if (request.query.debug === 'context') {
                        return reply(bcAppData.context);
                    }

                    content = Paper.compile(templateName, templateData.templates, bcAppData.context);
                    content = internals.decorateOutput(content, request, bcAppData);

                    replyResponse = reply(content);

                    if (response.headers['set-cookie']) {
                        replyResponse.header('set-cookie', response.headers['set-cookie']);
                    }

                    replyResponse.code(response.statusCode);
                });
            });
        }
    });
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
