import { escapeRegExp } from 'lodash-es';

// The link must start here. This stops a match on the "//host" part of "ftp://host" or
// "https://other.test//host".
const LINK_START = String.raw`(?<![\w:])`;

// "https:", "http:", or nothing (a protocol-relative link).
const SCHEME = '(?:https?:)?';

// "//", or "\/\/" in JSON-escaped strings. The capture lets the output keep the same style.
const SLASHES = String.raw`(\\?/\\?/)`;

// The host must end here. This stops a match on a longer host ("host.evil.test", "host-2.com")
// or on a different port ("host:8443"). A dot that ends a sentence ("Visit https://host.") is
// not part of the host, so the link is still rewritten.
const HOST_END = String.raw`(?![\w:-]|\.[^\s"'<])`;

/**
 * @param {string} storeHost - host (and port, if not default) of the storefront, e.g. `www.example.com`
 * @returns {RegExp} matches absolute, protocol-relative, and JSON-escaped links to the host
 */
function buildStorefrontLinkPattern(storeHost) {
    return new RegExp(LINK_START + SCHEME + SLASHES + escapeRegExp(storeHost) + HOST_END, 'gi');
}

/**
 * Makes a BrowserSync rewrite rule that changes absolute storefront links in HTML to the local
 * front door, so that navigation stays on localhost. Normal proxy mode does the same for the
 * renderer host.
 *
 * BrowserSync (resp-modifier) calls `fn(req, res, ...String.prototype.replace callback args)`.
 *
 * @param {string} storeUrl - e.g. `https://www.example.com`
 * @returns {{ match: RegExp, fn: Function }}
 */
function createStorefrontLinkRewriteRule(storeUrl) {
    return {
        match: buildStorefrontLinkPattern(new URL(storeUrl).host),
        fn: (req, _res, _matched, slashes) => {
            const localSlashes = slashes.includes('\\') ? '\\/\\/' : '//';
            return `http:${localSlashes}${req.headers.host}`;
        },
    };
}

export { buildStorefrontLinkPattern, createStorefrontLinkRewriteRule };
