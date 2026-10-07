import crypto from 'crypto';
import httpProxy from 'http-proxy';

const PREVIEW_HEADER_PREFIX = 'x-stencil-preview-';
const SESSION_HEADER = 'x-stencil-preview-session';
const TIMESTAMP_HEADER = 'x-stencil-preview-timestamp';
const SIGNATURE_HEADER = 'x-stencil-preview-signature';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Normalizes the request target.
 *
 * @param {string} rawUrl - request target from the incoming request
 * @param {string} origin - storefront origin
 * @returns {string | null} null when the target is not origin-form
 */
function getSignedPath(rawUrl, origin) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/')) {
        return null;
    }
    try {
        const url = new URL(`${origin}${rawUrl}`);
        return url.origin === origin ? `${url.pathname}${url.search}` : null;
    } catch {
        return null;
    }
}

function buildSigningString({ sessionId, timestamp, method, pathWithQuery }) {
    return `${sessionId}\n${timestamp}\n${method.toUpperCase()}\n${pathWithQuery}`;
}

/**
 * The HMAC key is the UTF-8 bytes of the hex access key string.
 *
 * @returns {Record<string, string>} the three proof headers
 */
function signPreviewRequest({ sessionId, accessKey, timestamp, method, pathWithQuery }) {
    const signature = crypto
        .createHmac('sha256', accessKey)
        .update(buildSigningString({ sessionId, timestamp, method, pathWithQuery }))
        .digest('hex');
    return {
        [SESSION_HEADER]: sessionId,
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: signature,
    };
}

function parseUrl(value) {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

function isLoopbackHost(host) {
    const url = typeof host === 'string' && host ? parseUrl(`http://${host}`) : null;
    return url !== null && LOOPBACK_HOSTNAMES.has(url.hostname);
}

function isLoopbackUrl(value) {
    const url = typeof value === 'string' ? parseUrl(value) : null;
    return url !== null && LOOPBACK_HOSTNAMES.has(url.hostname);
}

/**
 * Origin and Referer from the local front door point at the storefront instead.
 * Other values do not change.
 */
function rewriteRequestHeaders(request, storefrontOrigin) {
    const { origin, referer } = request.headers;
    if (isLoopbackUrl(origin)) {
        request.headers.origin = storefrontOrigin;
    }
    if (isLoopbackUrl(referer)) {
        const { pathname, search } = new URL(referer);
        request.headers.referer = `${storefrontOrigin}${pathname}${search}`;
    }
}

/**
 * Keeps the browser on the local front door when the storefront redirects to itself.
 * A redirect to another host does not change.
 */
function rewriteLocation(location, storefrontUrl, localOrigin) {
    if (typeof location !== 'string' || !/^(https?:)?\/\//i.test(location)) {
        return location;
    }
    let url;
    try {
        url = new URL(location, storefrontUrl);
    } catch {
        return location;
    }
    if (url.host !== storefrontUrl.host || !/^https?:$/.test(url.protocol)) {
        return location;
    }
    return `${localOrigin}${url.pathname}${url.search}${url.hash}`;
}

function sendText(response, status, message) {
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(message);
}

/**
 * Connect middleware for the local front door in Makeswift preview mode. It forwards each
 * request to the storefront with a per-request proof, so the access key never leaves the CLI.
 *
 * @param {object} options
 * @param {{ storeUrl: string, sessionId: string, accessKey: string }} options.previewSession -
 *   read on each request, so a re-registered session is used at once
 * @param {Function} [options.proxyFactory]
 * @param {{ error: Function }} [options.logger]
 * @param {() => number} [options.now]
 * @returns {(request: import('http').IncomingMessage, response: import('http').ServerResponse) => void}
 */
function createPreviewProxy({
    previewSession,
    proxyFactory = httpProxy.createProxyServer,
    logger = console,
    now = Date.now,
}) {
    const storefrontUrl = new URL(previewSession.storeUrl);
    const storefrontOrigin = storefrontUrl.origin;
    const proxy = proxyFactory({
        target: storefrontOrigin,
        changeOrigin: true,
        secure: true,
        xfwd: false,
    });

    proxy.on('proxyReq', (proxyRequest, request) => {
        // http-proxy collapses repeated slashes in the path. Send the exact signed path.
        Object.assign(proxyRequest, { path: request.url });
    });

    proxy.on('proxyRes', (proxyResponse, request) => {
        const { headers } = proxyResponse;
        if (headers.location) {
            headers.location = rewriteLocation(
                headers.location,
                storefrontUrl,
                `http://${request.headers.host}`,
            );
        }
    });

    proxy.on('error', (error, _request, response) => {
        logger.error(`Makeswift preview: the storefront request failed. ${error.message}`);
        if (!response || typeof response.writeHead !== 'function') {
            return;
        }
        if (response.headersSent) {
            response.destroy();
            return;
        }
        sendText(response, 502, 'Makeswift preview: the storefront request failed.');
    });

    return (request, response) => {
        // Blocks DNS rebinding: another site cannot use the browser to send signed requests.
        if (!isLoopbackHost(request.headers.host)) {
            sendText(response, 403, 'Makeswift preview is available only on localhost.');
            return;
        }
        const pathWithQuery = getSignedPath(request.url, storefrontOrigin);
        if (pathWithQuery === null) {
            sendText(response, 400, 'Bad request.');
            return;
        }

        for (const name of Object.keys(request.headers)) {
            if (name.startsWith(PREVIEW_HEADER_PREFIX)) {
                delete request.headers[name];
            }
        }
        delete request.headers.expect;
        rewriteRequestHeaders(request, storefrontOrigin);
        Object.assign(
            request.headers,
            signPreviewRequest({
                sessionId: previewSession.sessionId,
                accessKey: previewSession.accessKey,
                timestamp: now(),
                method: request.method,
                pathWithQuery,
            }),
        );
        request.url = pathWithQuery;

        proxy.web(request, response);
    };
}

export {
    buildSigningString,
    createPreviewProxy,
    getSignedPath,
    isLoopbackHost,
    rewriteLocation,
    signPreviewRequest,
};
