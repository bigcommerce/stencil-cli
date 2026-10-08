import crypto from 'crypto';

const REGISTER_PATH = '/api/makeswift/preview-sessions';
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

function isValidRegistration(data) {
    return (
        isNonEmptyString(data?.sessionId) &&
        isNonEmptyString(data?.accessKey) &&
        Number.isFinite(data?.expiresIn) &&
        data.expiresIn > 0
    );
}

/**
 * Registers a Makeswift preview session.
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
        const url = new URL(REGISTER_PATH, storeUrl);
        if (url.protocol !== 'https:') {
            throw previewSessionError('Makeswift preview requires an HTTPS store URL.');
        }

        let response;
        try {
            response = await this._fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    [ACCESS_TOKEN_HEADER]: accessToken,
                },
                body: JSON.stringify({ tunnelUrl, secret }),
                redirect: 'manual',
                signal: AbortSignal.timeout(this._timeout),
            });
        } catch {
            throw previewSessionError(
                'Could not register the Makeswift preview session: the request failed.',
                { retryable: true },
            );
        }

        const { status } = response;
        if (!response.ok) {
            const hint = status === 401 ? ' Make sure the access token in .stencil is valid.' : '';
            throw previewSessionError(
                `Could not register the Makeswift preview session (HTTP ${status}).${hint}`,
                { status, retryable: status === 429 || status >= 500 },
            );
        }

        const data = await response.json().catch(() => null);
        if (!isValidRegistration(data)) {
            throw previewSessionError(
                `Could not register the Makeswift preview session: the response (HTTP ${status}) is not valid.`,
                { status },
            );
        }

        const { sessionId, accessKey, expiresIn } = data;
        return { sessionId, accessKey, expiresIn };
    }
}

export { PreviewSessionClient };
export default new PreviewSessionClient();
