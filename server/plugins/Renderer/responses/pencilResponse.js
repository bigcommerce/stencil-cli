var _ = require('lodash'),
    Paper = require('stencil-paper'),
    Url = require('url'),
    internals = {};

module.exports = function (data, assembler) {
    this.respond = function (request, reply) {
        var response,
            output,
            html,
            paper,
            templatePath;

        // Set the environment to dev
        data.context.in_development = true;
        data.context.in_production = false;

        paper = new Paper(assembler);

        paper.addDecorator(internals.makeDecorator(request, data.context));

        templatePath = internals.getTemplatePath(request, data);

        paper.loadTheme(templatePath, data.acceptLanguage, function () {
            if (request.query.debug === 'context') {
                return reply(data.context);
            }

            if (data.remote || _.isArray(templatePath)) {
                
                if (data.remote) {
                    data.context = _.extend({}, data.context, data.remote_data);
                }

                if (data.template_file) {
                    // if multiple render_with
                    if (_.isArray(data.template_file)) {
                        // if data.template_file is an array ( multiple templates using render_with option)
                        // compile all the template required files into a hash table
                        html = data.template_file.reduce(function(table, file) {
                            table[file] = paper.render(file, data.context);

                            return table;
                        }, {});
                    } else {
                        html = paper.render(data.template_file, data.context);
                    }

                    if (data.remote) {
                        // combine the context & rendered html
                        output = {
                            data: data.remote_data,
                            content: html
                        };
                    } else {
                        output = html;
                    }
                } else {
                    output = {
                        data: data.remote_data
                    };
                }
            } else {
                output = paper.render(data.template_file, data.context);
            }

            response = reply(output);
            response.code(data.statusCode);

            if (data.headers['set-cookie']) {
                response.header('set-cookie', data.headers['set-cookie']);
            }
        });
    };
};


internals.getTemplatePath = function (request, data) {
    var path = data.template_file;

    if (request.headers['stencil-options']) {
        var options = JSON.parse(request.headers['stencil-options']);

        if (options['render_with'] && typeof options['render_with'] === 'string') {

            path = options['render_with'].split(',');
            
            path = _.map(path, function (path) {
                return 'components/' + path;
            });

            if (path.length === 1) {
                path = path[0];
            }
        }
    }

    return path;
};


/**
 * Output post-processing
 *
 * @param request
 * @param context
 */
internals.makeDecorator = function (request, context) {
    return function(content) {
        var regex,
            debugBar,
            stencilEditorSDK;

        if (context.settings) {
            regex = new RegExp(internals.escapeRegex(context.settings.base_url), 'g');
            content = content.replace(regex, '');

            regex = new RegExp(internals.escapeRegex(context.settings.secure_base_url), 'g');
            content = content.replace(regex, '');
        }

        if (request.query.debug === 'bar') {
            debugBar = '<pre style="background-color:#EEE; word-wrap:break-word;">';
            debugBar += internals.escapeHtml(JSON.stringify(context, null, 2)) + '</pre>';
            regex = new RegExp('</body>');
            content = content.replace(regex, debugBar + '\n</body>');
        }

        if (request.query.stencilEditor || request.state.stencil_editor_enabled) {
            stencilEditorSDK = '<script src="http://localhost:8181/public/jspm_packages/github/meenie/jschannel@0.0.5/src/jschannel.js"></script>';
            stencilEditorSDK += '<script src="http://localhost:8181/public/jspm_packages/github/js-cookie/js-cookie@2.0.3/src/js.cookie.js"></script>';
            stencilEditorSDK += '<script src="http://localhost:8181/public/js/stencil-editor.js"></script>';

            content = content.replace(new RegExp('</body>'), stencilEditorSDK + '\n</body>');
        }

        return content;
    }
};

/**
 * Scape html entities
 */
internals.escapeHtml = function () {
    var charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;'
    };

    return function (html) {
        return html.replace(/[&<>"]/g, function (tag) {
            return charsToReplace[tag] || tag;
        });
    }
}();

/**
 * Scape special characters for regular expression
 *
 * @param string
 */
internals.escapeRegex = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};
