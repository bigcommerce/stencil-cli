import 'colors';
import makeswiftProxyHealthModule from './makeswift-proxy-health.js';
import tunnelManagerModule from './TunnelManager.js';
import previewSessionClientModule from './PreviewSessionClient.js';
import PreviewSessionHeartbeat from './PreviewSessionHeartbeat.js';
import { createPreviewProxy } from './preview-proxy.js';

const PREVIEW_LISTEN_HOST = 'localhost';
// Ctrl-C must not be slow. A session that is not revoked expires with its TTL.
const SHUTDOWN_TIMEOUT_MS = 3000;

/**
 * Makeswift preview for `stencil start`: the tunnel, the preview session and its heartbeat,
 * the signing front door, and the cleanup on exit.
 */
class MakeswiftPreview {
    constructor({
        makeswiftProxyHealth = makeswiftProxyHealthModule,
        tunnelManager = tunnelManagerModule,
        previewSessionClient = previewSessionClientModule,
        previewProxyFactory = createPreviewProxy,
        previewSessionHeartbeatFactory = (options) => new PreviewSessionHeartbeat(options),
        processObj = process,
        logger = console,
        shutdownTimeout = SHUTDOWN_TIMEOUT_MS,
    } = {}) {
        this._makeswiftProxyHealth = makeswiftProxyHealth;
        this._tunnelManager = tunnelManager;
        this._previewSessionClient = previewSessionClient;
        this._previewProxyFactory = previewProxyFactory;
        this._previewSessionHeartbeatFactory = previewSessionHeartbeatFactory;
        this._process = processObj;
        this._logger = logger;
        this._shutdownTimeout = shutdownTimeout;
        this._tunnel = null;
        this._session = null;
        this._accessToken = null;
        this._heartbeat = null;
        this._shutdownPromise = null;
    }

    /**
     * The registered preview session, or null when preview is off.
     *
     * @returns {{ storeUrl: string, tunnelUrl: string, secret: string, sessionId: string, accessKey: string, expiresIn: number } | null}
     */
    get session() {
        return this._session;
    }

    /**
     * Preview mode turns on when the storefront host is routed through the Makeswift proxy.
     * A failed check never stops `stencil start`; it only turns preview mode off.
     *
     * @param {object} options
     * @param {string} options.storeUrl
     * @param {boolean | string} [options.tunnel] - the `--tunnel` CLI option
     * @returns {Promise<boolean>}
     */
    async isEnabled({ storeUrl, tunnel }) {
        const enabled = await this._makeswiftProxyHealth.isMakeswiftProxyActive({ storeUrl });
        if (enabled && tunnel) {
            this._logger.log(
                `${'Notice'.yellow}: Makeswift preview is off because --tunnel is set. ` +
                    'Remove --tunnel to use Makeswift preview.',
            );
            return false;
        }
        return enabled;
    }

    /**
     * Starts the Cloudflare tunnel to the renderer port (not the local front door) and registers
     * the preview session. If either fails, `stencil start` continues without Makeswift preview.
     * Call it before the renderer starts, so the renderer requires the secret only when a
     * session exists.
     *
     * @param {object} options
     * @param {number} options.localPort - BrowserSync port, the local front door
     * @param {number} options.rendererPort
     * @param {string} options.storeUrl
     * @param {string} [options.accessToken]
     * @throws {Error} when there is no access token
     */
    async start({ localPort, rendererPort, storeUrl, accessToken }) {
        if (!accessToken) {
            throw new Error(
                'Makeswift preview requires an access token. Add accessToken to your .stencil file.'.red,
            );
        }
        this._logger.log('Makeswift is enabled for this storefront. Starting Makeswift preview...');
        try {
            this._tunnel = await this._tunnelManager.start(rendererPort);
        } catch (err) {
            this._warnUnavailable(err);
            return;
        }
        this._registerShutdownHandlers();
        const secret = this._previewSessionClient.createSecret();
        try {
            const tunnelUrl = this._tunnel.url;
            const registration = await this._previewSessionClient.register({
                storeUrl,
                accessToken,
                tunnelUrl,
                secret,
            });
            this._session = { storeUrl, tunnelUrl, secret, ...registration };
            this._accessToken = accessToken;
        } catch (err) {
            await this.stop();
            this._warnUnavailable(err);
            return;
        }
        this._heartbeat = this._previewSessionHeartbeatFactory({
            client: this._previewSessionClient,
            session: this._session,
            accessToken,
            logger: this._logger,
        });
        this._heartbeat.start();
        const localUrl = `http://${PREVIEW_LISTEN_HOST}:${localPort}`;
        this._logger.log(
            `Makeswift preview is active. Open ${localUrl.cyan}\n` +
                'The Makeswift preview session ends when you stop stencil start.',
        );
    }

    /**
     * The local front door proxies to the storefront (not the renderer) and signs each request.
     * The worker sends the request back to the renderer through the tunnel. It listens on
     * localhost (a loopback address) only, so other devices cannot send signed requests.
     *
     * @returns {object} BrowserSync options
     */
    getBrowserSyncOptions() {
        return {
            listen: PREVIEW_LISTEN_HOST,
            // No static files. BrowserSync's own routes and HTML snippet injection still run
            // first; the proxy middleware handles all other requests.
            server: { baseDir: [] },
            middleware: [
                this._previewProxyFactory({
                    previewSession: this._session,
                    logger: this._logger,
                }),
            ],
            tunnel: false,
        };
    }

    /**
     * Stops the heartbeat and the tunnel, and revokes the session. Safe to call more than once.
     * It does not fail and it takes at most the shutdown timeout. A failed revoke is not shown:
     * the session expires with its TTL.
     *
     * @returns {Promise<void>}
     */
    shutdown() {
        this._shutdownPromise ??= this._shutdown();
        return this._shutdownPromise;
    }

    /**
     * Stops the heartbeat and the tunnel. It does not revoke the session.
     *
     * @returns {Promise<void>}
     */
    stop() {
        this._heartbeat?.stop();
        this._heartbeat = null;
        const tunnel = this._tunnel;
        this._tunnel = null;
        return tunnel ? tunnel.stop() : Promise.resolve();
    }

    async _shutdown() {
        const session = this._session;
        const accessToken = this._accessToken;
        this._accessToken = null;
        // Stop the heartbeat first, so it cannot change or renew the session that is revoked.
        const stopped = this.stop();
        const revoked = session
            ? this._previewSessionClient.revoke({
                  storeUrl: session.storeUrl,
                  accessToken,
                  sessionId: session.sessionId,
              })
            : undefined;
        let timer;
        const timedOut = new Promise((resolve) => {
            timer = setTimeout(resolve, this._shutdownTimeout);
            timer.unref();
        });
        await Promise.race([Promise.allSettled([stopped, revoked]), timedOut]);
        clearTimeout(timer);
    }

    _registerShutdownHandlers() {
        let shuttingDown = false;
        const onSignal = async (signal) => {
            if (shuttingDown) {
                this._process.exit(1);
                return;
            }
            shuttingDown = true;
            try {
                await this.shutdown();
            } finally {
                this._process.exit(signal === 'SIGINT' ? 130 : 143);
            }
        };
        this._process.on('SIGINT', onSignal);
        this._process.on('SIGTERM', onSignal);
        // Other exits must not leave cloudflared running. This handler must be synchronous, so it
        // cannot revoke the session; the session TTL ends it.
        this._process.once('exit', () => this.stop());
    }

    _warnUnavailable(err) {
        this._logger.error(
            `${'Warning'.yellow}: Makeswift preview is not available. ${err.message}\n` +
                'The local server continues without Makeswift preview.',
        );
    }
}

export default MakeswiftPreview;
