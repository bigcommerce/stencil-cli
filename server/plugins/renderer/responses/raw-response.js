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
        var payload = Buffer.isBuffer(data) ? data.toString('utf8') : '';
        internals.stubActiveConfig = request.app.themeConfig.variationIndex + 1;

        // TODO This will change when we build the new checkout in SFP.
        if (request.url.path.startsWith('/checkout.php') || request.url.path.startsWith('/finishorder.php')) {
            payload = appendCss(payload);
        }

        // To be removed when we go to Phase 3
        if (request.url.path.startsWith('/checkout')) {
            payload = payload.replace(/http[s]?:\/\/.*?\/optimized-checkout.css/, '/stencil/' + internals.stubActiveVersion + '/' + internals.stubActiveConfig + '/css/optimized-checkout.css');
        }

        response = reply(payload).code(statusCode);

        response.header('content-length', Buffer.byteLength(payload));

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
