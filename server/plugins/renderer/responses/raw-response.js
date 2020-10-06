const cheerio = require('cheerio');
const utils = require('../../../lib/utils');

const internals = {
    stubActiveVersion: utils.int2uuid(1),
    stubActiveConfig: utils.int2uuid(1),
};

class RawResponse {
    /**
     * @param {buffer} data
     * @param {{[string]: string[]}} headers
     * @param {string} statusCode
     * @returns {object} response
     */
    constructor(data, headers, statusCode) {
        this.data = data;
        this.headers = headers;
        this.statusCode = statusCode;
    }

    respond(request, h) {
        let payload = this.data;
        internals.stubActiveConfig = utils.int2uuid(request.app.themeConfig.variationIndex + 1);

        if (
            request.path.startsWith('/checkout.php') ||
            request.path.startsWith('/finishorder.php')
        ) {
            payload = this._appendCss(payload.toString('utf8'));
        }

        // To be removed when we go to Phase 3
        if (request.path.startsWith('/checkout')) {
            payload = payload
                .toString('utf8')
                .replace(
                    /http[s]?:\/\/.*?\/optimized-checkout.css/,
                    `/stencil/${internals.stubActiveVersion}/${internals.stubActiveConfig}/css/optimized-checkout.css`,
                );
        }

        const response = h.response(payload).code(this.statusCode);

        for (const [name, values] of Object.entries(this.headers)) {
            switch (name) {
                case 'transfer-encoding':
                case 'content-length':
                    break;
                case 'set-cookie':
                    // Cookies should be an array
                    response.header('set-cookie', values);
                    break;
                default:
                    // Other headers should be strings
                    response.header(name, values.toString());
            }
        }

        return response;
    }

    /**
     * @private
     * Append checkout.css to override styles.
     * @param {string} payload
     * @returns {string}
     */
    _appendCss(payload) {
        const dom = cheerio.load(payload);
        const url = `/stencil/${internals.stubActiveVersion}/${internals.stubActiveConfig}/css/checkout.css`;

        dom('head').append(`<link href="${url}" type="text/css" rel="stylesheet">`);
        return dom.html();
    }
}

module.exports = RawResponse;
