var _ = require('lodash');
var cheerio = require('cheerio');
var internals = {
    stubActiveVersion: 'theme',
    stubActiveConfig: 1,
};
/**
 * @param {buffer} data
 * @param {object} headers
 * @param {string} statusCode
 * @return {object} response
 */
function RawResponse(data, headers, statusCode) {

    this.respond = function (request, reply) {
        var response;
        var paylaod = Buffer.isBuffer(data) ? data.toString('utf8') : '';
        internals.stubActiveConfig = request.app.themeConfig.variationIndex + 1;

        // TODO This will change when we build the new checkout in SFP.
        if (request.url.path.indexOf('/checkout.php') === 0 || request.url.path.indexOf('/finishorder.php') === 0) {
            paylaod = appendCss(paylaod);
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
function appendCss(payload) {
    var dom = cheerio.load(payload);

    dom('head').append('<link href="/stencil/'+ internals.stubActiveVersion + '/' + internals.stubActiveConfig + '/css/checkout.css" type="text/css" rel="stylesheet">');
    return dom.html();
}

module.exports = RawResponse;
