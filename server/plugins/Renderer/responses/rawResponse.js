var _ = require('lodash'),
    cheerio = require('cheerio'),
    internals = {};

module.exports = function (data, headers, statusCode) {

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
        var domFromBuffer = cheerio.load(buffer);
        domFromBuffer('head').append('<link href="/assets/css/checkout.css" type="text/css" rel="stylesheet">');
        return domFromBuffer.html();
    }

    return false;
};

