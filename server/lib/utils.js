const uuidRegExp = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12})';

/**
 * Strip domain from the cookies header string
 *
 * @param {string[]} cookies
 * @returns {string[]}
 */
function stripDomainFromCookies(cookies) {
    return cookies.map((val) =>
        val
            .replace(/(?:;\s)?domain=(?:.+?)(;|$)/gi, '$1')
            .replace(new RegExp('; SameSite=none', 'gi'), ''),
    );
}

/**
 * Strip domain from redirectUrl if it matches the current storeUrl, if not, leave it.
 *
 * @param request
 * @param redirectUrl
 * @returns {string}
 */
function normalizeRedirectUrl(request, redirectUrl) {
    const storeHost = new URL(request.app.normalStoreUrl).host;
    const secureStoreHost = new URL(request.app.storeUrl).host;
    const redirectUrlObj = new URL(redirectUrl);
    let stripHost = false;

    if (redirectUrlObj.host === storeHost || redirectUrlObj.host === secureStoreHost) {
        stripHost = true;
    }

    if (stripHost) {
        return redirectUrlObj.pathname + redirectUrlObj.search + redirectUrlObj.hash;
    }
    return redirectUrl;
}

/**
 * Convert a number to uuid
 *
 * @param {number} number
 * @returns {string}
 */
function int2uuid(number) {
    const id = `000000000000${number}`.substr(-12);
    return `00000000-0000-0000-0000-${id}`;
}

/**
 * Convert a uuid to int
 *
 * @param {string} uuid
 * @returns {number}
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
