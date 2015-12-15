var _ = require('lodash'),
    cheerio = require('cheerio'),
    Url = require('url'),
    utils = require('../../../lib/utils'),
    internals = {
        stubActiveVersion: 'theme'
    };

module.exports = function (request, data, headers, statusCode) {
    internals.stubActiveConfig = request.app.themeConfig.variationIndex + 1;

    this.respond = function (request, reply) {
        var response;

        // TODO This will change when we build the new checkout in SFP.
        if (request.url.path.indexOf('/checkout.php') === 0 || request.url.path.indexOf('/finishorder.php') === 0) {
            data = internals.stripDomain(request, data.toString('utf8'));
            response = reply(internals.appendCss(data));
        } else {
            if (request.url.path.indexOf('/remote.php') === 0) {
                data = internals.patchLegacyRemoteCheckoutRoutes(request, data);
            }

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
 * If a remote.php request fires from the legacy checkout flow, patch the urls to stay on the development server
 * @param request
 * @param data
 */
internals.patchLegacyRemoteCheckoutRoutes = function(request, data) {
    var referer = Url.parse(request.headers.referer);
    var jsonResponse;
    var index;

    if (referer.path.indexOf('/checkout.php') === 0) {
        data = data.toString('utf8');

        try {
            jsonResponse = JSON.parse(data);

            if (jsonResponse.stepContent) {
                for (index = 0; index < jsonResponse.stepContent.length; index++) {
                    jsonResponse.stepContent[index].content = internals.stripDomain(
                        request,
                        jsonResponse.stepContent[index].content
                    );
                }
            }

            data = JSON.stringify(jsonResponse);
        } catch (e) {
            console.error(e);
            data = internals.stripDomain(request, data);
        }
    }

    return data;
};

/**
 * Strip the store domains from a response. Used to strip checkout domains and maintain session on development server
 * @param request
 * @param utf8Content
 * @returns {*}
 */
internals.stripDomain = function(request, utf8Content) {
    if (request.app.normalStoreUrl) {
        regex = new RegExp(utils.escapeRegex(request.app.normalStoreUrl), 'g');
        utf8Content = utf8Content.replace(regex, '');
    }
    if (request.app.storeUrl) {
        regex = new RegExp(utils.escapeRegex(request.app.storeUrl), 'g');
        utf8Content = utf8Content.replace(regex, '');
    }

    return utf8Content;
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

