var _ = require('lodash'),
    Url = require('url');

/**
 * Strip domain from cookies
 *
 * @param cookies
 * @returns {Array}
 */
module.exports.stripDomainFromCookies = function(cookies) {
    var fixedCookies = [];

    _.forEach(cookies, function(cookie) {
        fixedCookies.push(cookie.replace(/(?:;\s)?domain=(?:.+?)(;|$)/, '$1'));
    });

    return fixedCookies;
};

/**
 * Strip domain from redirectUrl if it matches the current storeUrl, if not, leave it.
 *
 * @param request
 * @param redirectUrl
 * @returns {string}
 */
module.exports.normalizeRedirectUrl = function(request, redirectUrl) {
    var storeHost = Url.parse(request.app.normalStoreUrl).host,
        secureStoreHost = Url.parse(request.app.storeUrl).host,
        redirectUrlObj = Url.parse(redirectUrl),
        stripHost = false;

    if (! redirectUrlObj.host || redirectUrlObj.host === storeHost || redirectUrlObj.host === secureStoreHost) {
        stripHost = true;
    }

    if (stripHost) {
        return redirectUrlObj.path;
    } else {
        return redirectUrl;
    }
};

/**
 * Scape special characters for regular expression
 *
 * @param string
 */
module.exports.escapeRegex = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};
