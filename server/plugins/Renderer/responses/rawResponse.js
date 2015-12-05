var _ = require('lodash'),
    cheerio = require('cheerio'),
    internals = {
        stubActiveVersion: 'theme'
    };

module.exports = function (request, data, headers, statusCode) {
    internals.stubActiveConfig = request.app.themeConfig.variationIndex + 1;

    this.respond = function (request, reply) {
        var response;
        // TODO This will change when we build the new checkout in SFP.
        if (request.url.path.indexOf('/checkout.php') === 0) {
            response = reply(internals.appendCss(data));
        } else {
            response = reply(data);
        }

        response.statusCode = statusCode;

        _.each(headers, function (value, name) {
            response.header(name, value);
        });

        return response;
    };
};

/**
 * Append checkout.css to override styles.
 * @param buffer
 * @returns {*}
 */

internals.appendCss = function (buffer) {
    if (buffer) {
        var dom = cheerio.load(buffer);
        dom('head').append('<link href="/stencil/'+ internals.stubActiveVersion + '/' + internals.stubActiveConfig + '/css/checkout.css" type="text/css" rel="stylesheet">');
        return dom.html();
    }

    return false;
};

