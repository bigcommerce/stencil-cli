import 'colors';

// The worker TTL is 300s, so 4 heartbeats in a row can fail before the session expires.
const INTERVAL_MS = 60000;
const WARN_AFTER_FAILURES = 2;

/**
 * Keeps a Makeswift preview session alive with a heartbeat every 60s. A failed heartbeat is
 * retried on the next tick. When the session is gone (404), it registers a new one and updates
 * the live session object, so the preview proxy uses it on the next request.
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
        this._busy = false;
        this._failures = 0;
    }

    start() {
        this.stop();
        this._failures = 0;
        const timer = setInterval(() => this._beat(timer), INTERVAL_MS);
        timer.unref();
        this._timer = timer;
    }

    stop() {
        clearInterval(this._timer);
        this._timer = null;
    }

    async _beat(timer) {
        // The client times out after 10s, so this only skips a tick in unusual cases.
        if (this._busy) {
            return;
        }
        this._busy = true;
        const stopped = () => this._timer !== timer;
        try {
            await this._keepAlive(stopped);
            if (stopped()) {
                return;
            }
            if (this._failures >= WARN_AFTER_FAILURES) {
                this._logger.log('The Makeswift preview session is renewed.');
            }
            this._failures = 0;
        } catch (err) {
            if (!stopped()) {
                this._onFailure(err);
            }
        } finally {
            this._busy = false;
        }
    }

    /**
     * @param {() => boolean} stopped - true after stop(); then the session must not change
     */
    async _keepAlive(stopped) {
        const { storeUrl, tunnelUrl, secret, sessionId } = this._session;
        const accessToken = this._accessToken;
        try {
            await this._client.heartbeat({ storeUrl, accessToken, sessionId });
            return;
        } catch (err) {
            if (err.status !== 404 || stopped()) {
                throw err;
            }
        }
        const registration = await this._client.register({
            storeUrl,
            accessToken,
            tunnelUrl,
            secret,
        });
        if (stopped()) {
            return;
        }
        const { sessionId: newSessionId, accessKey, expiresIn } = registration;
        Object.assign(this._session, { sessionId: newSessionId, accessKey, expiresIn });
        this._logger.log('The Makeswift preview session expired. A new session is registered.');
    }

    _onFailure(err) {
        if (!err.retryable) {
            this.stop();
            this._logger.error(
                `${'Error'.red}: ${err.message}\n` +
                    'Makeswift preview stops when the session expires. ' +
                    'Correct the problem, then restart stencil start.',
            );
            return;
        }
        this._failures += 1;
        if (this._failures === WARN_AFTER_FAILURES) {
            this._logger.error(
                `${'Warning'.yellow}: ${err.message} Retrying in ${INTERVAL_MS / 1000}s.\n` +
                    'Makeswift preview can stop working until the session is renewed.',
            );
        }
    }
}

export default PreviewSessionHeartbeat;
