import 'colors';

const MIN_DELAY_MS = 30000;
const RENEW_MARGIN_MS = 60000;
const RETRY_DELAYS_MS = [15000, 30000, 60000];
const WARN_AFTER_FAILURES = 2;

/**
 * Keeps a Makeswift preview session alive. When the session is gone (404), it registers a new
 * one and updates the live session object, so the preview proxy uses it on the next request.
 */
class PreviewSessionHeartbeat {
    /**
     * @param {object} options
     * @param {{ heartbeat: Function, register: Function }} options.client - PreviewSessionClient
     * @param {{ storeUrl: string, tunnelUrl: string, secret: string, sessionId: string, accessKey: string, expiresIn: number }} options.session -
     *   the live session object; changed in place
     * @param {string} options.accessToken
     * @param {{ log: Function, error: Function }} [options.logger]
     */
    constructor({ client, session, accessToken, logger = console }) {
        this._client = client;
        this._session = session;
        this._accessToken = accessToken;
        this._logger = logger;
        this._timer = null;
        this._stopped = true;
        this._failures = 0;
        this._needsRegister = false;
    }

    start() {
        this.stop();
        this._stopped = false;
        this._schedule(this._renewDelay());
    }

    stop() {
        this._stopped = true;
        clearTimeout(this._timer);
        this._timer = null;
    }

    _renewDelay() {
        return Math.max(MIN_DELAY_MS, this._session.expiresIn * 1000 - RENEW_MARGIN_MS);
    }

    _schedule(delay) {
        this._timer = setTimeout(() => this._beat(), delay);
        this._timer.unref();
    }

    async _beat() {
        this._timer = null;
        try {
            await (this._needsRegister ? this._register() : this._renew());
        } catch (err) {
            if (!this._stopped) {
                this._onFailure(err);
            }
            return;
        }
        if (this._stopped) {
            return;
        }
        if (this._failures >= WARN_AFTER_FAILURES) {
            this._logger.log('The Makeswift preview session is renewed.');
        }
        this._failures = 0;
        this._schedule(this._renewDelay());
    }

    async _renew() {
        const { storeUrl, sessionId } = this._session;
        let result;
        try {
            result = await this._client.heartbeat({
                storeUrl,
                accessToken: this._accessToken,
                sessionId,
            });
        } catch (err) {
            if (err.status !== 404) {
                throw err;
            }
            this._needsRegister = true;
            await this._register();
            return;
        }
        if (!this._stopped) {
            this._session.expiresIn = result.expiresIn;
        }
    }

    async _register() {
        if (this._stopped) {
            return;
        }
        const { storeUrl, tunnelUrl, secret } = this._session;
        const { sessionId, accessKey, expiresIn } = await this._client.register({
            storeUrl,
            accessToken: this._accessToken,
            tunnelUrl,
            secret,
        });
        if (this._stopped) {
            return;
        }
        Object.assign(this._session, { sessionId, accessKey, expiresIn });
        this._needsRegister = false;
        this._logger.log('The Makeswift preview session expired. A new session is registered.');
    }

    _onFailure(err) {
        if (!err.retryable) {
            this._logger.error(
                `${'Error'.red}: ${err.message}\n` +
                    'Makeswift preview stops when the session expires. ' +
                    'Correct the problem, then restart stencil start.',
            );
            return;
        }
        this._failures += 1;
        const delay = RETRY_DELAYS_MS[Math.min(this._failures, RETRY_DELAYS_MS.length) - 1];
        if (this._failures === WARN_AFTER_FAILURES) {
            this._logger.error(
                `${'Warning'.yellow}: ${err.message} Retrying in ${delay / 1000}s.\n` +
                    'Makeswift preview can stop working until the session is renewed.',
            );
        }
        this._schedule(delay);
    }
}

export default PreviewSessionHeartbeat;
