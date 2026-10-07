import { spawn as nodeSpawn } from 'child_process';
import { once } from 'events';

// TODO: Automatically install cloudflared for Makeswift users
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const INSTALL_HINT =
    'Install cloudflared and make sure it is on your PATH: ' +
    'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';

/**
 * Starts a Cloudflare Quick Tunnel (no Cloudflare account needed) to a local port.
 */
class TunnelManager {
    constructor({ spawn = nodeSpawn, startTimeout = 30000 } = {}) {
        this._spawn = spawn;
        this._startTimeout = startTimeout;
    }

    /**
     * @param {number} port
     * @returns {Promise<{ url: string, stop: () => Promise<void> }>}
     */
    async start(port) {
        const child = this._spawn(
            'cloudflared',
            // --grace-period: on SIGTERM, exit after 1s instead of the default 30s.
            [
                'tunnel',
                '--url',
                `http://localhost:${port}`,
                '--no-autoupdate',
                '--grace-period',
                '1s',
            ],
            // cloudflared writes its log, including the tunnel URL, to stderr.
            { stdio: ['ignore', 'ignore', 'pipe'] },
        );
        // Rejects on a spawn error, for example ENOENT when cloudflared is not installed.
        const exited = once(child, 'exit');
        let stopPromise;
        const stop = () => {
            stopPromise ??= (async () => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGTERM');
                }
                await exited.catch(() => {});
            })();
            return stopPromise;
        };

        let log = '';
        let onLog;
        let timer;
        try {
            const url = await new Promise((resolve, reject) => {
                onLog = (chunk) => {
                    log += chunk;
                    const match = log.match(TUNNEL_URL_PATTERN);
                    if (match) {
                        resolve(match[0]);
                    }
                };
                child.stderr.on('data', onLog);
                exited.then(
                    ([code, signal]) =>
                        reject(
                            new Error(
                                `cloudflared exited (${
                                    signal || `code ${code}`
                                }) before it returned a tunnel URL.`,
                            ),
                        ),
                    (err) =>
                        reject(
                            err.code === 'ENOENT'
                                ? new Error(`cloudflared was not found. ${INSTALL_HINT}`)
                                : err,
                        ),
                );
                timer = setTimeout(
                    () =>
                        reject(
                            new Error(
                                `cloudflared did not return a tunnel URL after ${
                                    this._startTimeout / 1000
                                }s. Check your network connection.`,
                            ),
                        ),
                    this._startTimeout,
                );
            });
            return { url, stop };
        } catch (err) {
            await stop();
            const lastLines = log.trim().split('\n').slice(-5).join('\n');
            err.message += lastLines ? `\ncloudflared output:\n${lastLines}` : '';
            throw err;
        } finally {
            clearTimeout(timer);
            child.stderr.off('data', onLog);
            // Keep reading stderr so cloudflared does not block on a full pipe.
            child.stderr.resume();
        }
    }
}

export { TunnelManager };
export default new TunnelManager();
