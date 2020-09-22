'use strict';

const _ = require('lodash');
const Url = require('url');
const uuidRegExp = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12})';

/**
 * Strip domain from cookies
 *
 * @param cookies
 * @returns {Array}
 */
function stripDomainFromCookies(cookies) {
    const fixedCookies = [];

    _.forEach(cookies, function(cookie) {
        fixedCookies.push(cookie.replace(/(?:;\s)?domain=(?:.+?)(;|$)/, '$1').replace('; SameSite=none', ''));
    });

    return fixedCookies;
}

/**
 * Strip domain from redirectUrl if it matches the current storeUrl, if not, leave it.
 *
 * @param request
 * @param redirectUrl
 * @returns {string}
 */
function normalizeRedirectUrl(request, redirectUrl) {
    const storeHost = Url.parse(request.app.normalStoreUrl).host;
    const secureStoreHost = Url.parse(request.app.storeUrl).host;
    const redirectUrlObj = Url.parse(redirectUrl);
    let stripHost = false;

    if (! redirectUrlObj.host || redirectUrlObj.host === storeHost || redirectUrlObj.host === secureStoreHost) {
        stripHost = true;
    }

    if (stripHost) {
        return redirectUrlObj.path;
    } else {
        return redirectUrl;
    }
}

/**
 * Convert a number to uuid
 *
 * @param {Number} number
 * @returns {String}
 */
function int2uuid(number) {
    const id = `000000000000${number}`.substr(-12);
    return `00000000-0000-0000-0000-${id}`;
}

/**
 * Convert a uuid to int
 *
 * @param {String} uuid
 * @returns {Number}
 */
function uuid2int(uuid) {
    const match = uuid.match(new RegExp(uuidRegExp));

    if (!match) {
        throw new Error(`Not uuid match for ${uuid}`);
    }

    return match ? parseInt(match[1], 10) : 0;
}

module.exports = {
    stripDomainFromCookies,
    normalizeRedirectUrl,
    int2uuid,
    uuid2int,
    uuidRegExp,
};
