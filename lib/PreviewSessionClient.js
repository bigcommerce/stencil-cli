import crypto from 'crypto';

const SESSIONS_PATH = '/api/makeswift/preview-sessions';
const ACCESS_TOKEN_HEADER = 'x-stencil-access-token';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * @param {string} message
 * @param {{ status?: number, retryable?: boolean }} [options]
 * @returns {Error & { status?: number, retryable: boolean }}
 */
function previewSessionError(message, { status, retryable = false } = {}) {
    return Object.assign(new Error(message), { status, retryable });
}

const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

const isValidExpiresIn = (data) => Number.isFinite(data?.expiresIn) && data.expiresIn > 0;

function isValidRegistration(data) {
    return (
        isNonEmptyString(data?.sessionId) &&
        isNonEmptyString(data?.accessKey) &&
        isValidExpiresIn(data)
    );
}

/**
 * Registers and renews Makeswift preview sessions.
 */
class PreviewSessionClient {
    constructor({ fetch = globalThis.fetch, timeout = REQUEST_TIMEOUT_MS } = {}) {
        this._fetch = fetch;
        this._timeout = timeout;
    }

    /**
     * The worker sends this secret to the local renderer on each tunnel request.
     *
     * @returns {string}
     */
    createSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * @param {object} options
     * @param {string} options.storeUrl - channel URL, or the store URL when there is no channel URL
     * @param {string} options.accessToken
     * @param {string} options.tunnelUrl
     * @param {string} options.secret
     * @returns {Promise<{ sessionId: string, accessKey: string, expiresIn: number }>}
     */
    async register({ storeUrl, accessToken, tunnelUrl, secret }) {
        const data = await this._post({
            storeUrl,
            path: SESSIONS_PATH,
            accessToken,
            body: { tunnelUrl, secret },
            action: 'register',
            isValid: isValidRegistration,
        });
        const { sessionId, accessKey, expiresIn } = data;
        return { sessionId, accessKey, expiresIn };
    }

    /**
     * Renews the session TTL. The access key does not change.
     * A 404 error means the session is gone and must be registered again.
     *
     * @param {object} options
     * @param {string} options.storeUrl
     * @param {string} options.accessToken
     * @param {string} options.sessionId
     * @returns {Promise<{ expiresIn: number }>}
     */
    async heartbeat({ storeUrl, accessToken, sessionId }) {
        const { expiresIn } = await this._post({
            storeUrl,
            path: `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/heartbeat`,
            accessToken,
            action: 'renew',
            isValid: isValidExpiresIn,
        });
        return { expiresIn };
    }

    async _post({ storeUrl, path, accessToken, body, action, isValid }) {
        const url = new URL(path, storeUrl);
        if (url.protocol !== 'https:') {
            throw previewSessionError('Makeswift preview requires an HTTPS store URL.');
        }
        const failure = `Could not ${action} the Makeswift preview session`;

        let response;
        try {
            response = await this._fetch(url, {
                method: 'POST',
                headers: {
                    ...(body && { 'content-type': 'application/json' }),
                    [ACCESS_TOKEN_HEADER]: accessToken,
                },
                body: body && JSON.stringify(body),
                redirect: 'manual',
                signal: AbortSignal.timeout(this._timeout),
            });
        } catch {
            throw previewSessionError(`${failure}: the request failed.`, { retryable: true });
        }

        const { status } = response;
        if (!response.ok) {
            const hint = status === 401 ? ' Make sure the access token in .stencil is valid.' : '';
            throw previewSessionError(`${failure} (HTTP ${status}).${hint}`, {
                status,
                retryable: status === 429 || status >= 500,
            });
        }

        const data = await response.json().catch(() => null);
        if (!isValid(data)) {
            throw previewSessionError(`${failure}: the response (HTTP ${status}) is not valid.`, {
                status,
            });
        }
        return data;
    }
}

export { PreviewSessionClient };
export default new PreviewSessionClient();
