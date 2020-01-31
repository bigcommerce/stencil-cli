const _ = require('lodash');
const cheerio = require('cheerio');
const Utils = require('../../../lib/utils');
const internals = {
    stubActiveVersion: Utils.int2uuid(1),
    stubActiveConfig: Utils.int2uuid(1),
};

/**
 * @param {buffer} data
 * @param {object} headers
 * @param {string} statusCode
 * @return {object} response
 */
function RawResponse(data, headers, statusCode) {

    this.respond = function (request, reply) {
        var payload = data;
        internals.stubActiveConfig = Utils.int2uuid(request.app.themeConfig.variationIndex + 1);

        if (request.url.path.startsWith('/checkout.php') || request.url.path.startsWith('/finishorder.php')) {
            payload = appendCss(payload.toString('utf8'));
        }

        // To be removed when we go to Phase 3
        if (request.url.path.startsWith('/checkout')) {
            payload = payload.toString('utf8')
                .replace(
                    /http[s]?:\/\/.*?\/optimized-checkout.css/,
                    `/stencil/${internals.stubActiveVersion}/${internals.stubActiveConfig}/css/optimized-checkout.css`,
                );
        }

        const response = reply(payload).code(statusCode);

        _.each(headers, (value, name) => {
            if (['transfer-encoding', 'content-length'].indexOf(name) === -1) {
                response.header(name, value);
            }
        });

        return response;
    };
}

/**
 * Append checkout.css to override styles.
 * @param {string} payload
 * @returns {string}
 */
function appendCss(payload) {
    const dom = cheerio.load(payload);
    const url = `/stencil/${internals.stubActiveVersion}/${internals.stubActiveConfig}/css/checkout.css`;

    dom('head').append(`<link href="${url}" type="text/css" rel="stylesheet">`);
    return dom.html();
}

module.exports = RawResponse;
