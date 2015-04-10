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
 * Change passed in redirectUrl host to the one inside the require.headers object
 *
 * @param request
 * @param redirectUrl
 * @returns {string}
 */
module.exports.normalizeRedirectUrl = function(request, redirectUrl) {
    var protocol = request.headers['x-forwarded-proto'] || 'http',
        referer = Url.parse(protocol + '://' + request.headers.host),
        redirectPath = Url.parse(redirectUrl).path;

    return referer.protocol + '//' + referer.host + redirectPath;
};
