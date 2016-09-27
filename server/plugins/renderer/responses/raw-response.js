var _ = require('lodash'),
    cheerio = require('cheerio'),
    internals = {
        stubActiveVersion: 'theme'
    };

module.exports = function (request, data, headers, statusCode) {
    internals.stubActiveConfig = request.app.themeConfig.variationIndex + 1;

    this.respond = function (request, reply) {
        var response;
        var paylaod = Buffer.isBuffer(data) ? data.toString('utf8') : '';

        // TODO This will change when we build the new checkout in SFP.
        if (request.url.path.indexOf('/checkout.php') === 0 || request.url.path.indexOf('/finishorder.php') === 0) {
            paylaod = internals.appendCss(paylaod);
        }

        response = reply(paylaod).code(statusCode);

        response.header('content-length', Buffer.byteLength(paylaod));

        _.each(headers, function (value, name) {
            if (['transfer-encoding', 'content-length'].indexOf(name) === -1) {
                response.header(name, value);
            }
        });

        return response;
    };
};

/**
 * Append checkout.css to override styles.
 * @param {string} payload
 * @returns {string}
 */
internals.appendCss = function (payload) {
    var dom = cheerio.load(payload);

    dom('head').append('<link href="/stencil/'+ internals.stubActiveVersion + '/' + internals.stubActiveConfig + '/css/checkout.css" type="text/css" rel="stylesheet">');
    return dom.html();
};
