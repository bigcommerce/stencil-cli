import { spawn as nodeSpawn } from 'child_process';
import { once } from 'events';
import cloudflaredBinaryModule, { INSTALL_URL, PATH_ENV } from './cloudflared-binary.js';

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const INSTALL_HINT = `Install cloudflared, or set ${PATH_ENV} to the path of cloudflared: ${INSTALL_URL}`;
// Keep only the end of the cloudflared log, for error messages.
const LOG_TAIL_LENGTH = 16 * 1024;
const LOG_TAIL_LINES = 5;

/**
 * Starts a Cloudflare Quick Tunnel (no Cloudflare account needed) to a local port.
 */
class TunnelManager {
    constructor({
        spawn = nodeSpawn,
        cloudflaredBinary = cloudflaredBinaryModule,
        startTimeout = 30000,
        killTimeout = 2000,
    } = {}) {
        this._spawn = spawn;
        this._cloudflaredBinary = cloudflaredBinary;
        this._startTimeout = startTimeout;
        this._killTimeout = killTimeout;
    }

    /**
     * `exited` resolves when cloudflared exits for any reason, including stop(). It does not
     * reject. `reason` is the exit code or signal; `output` is the last lines of the log.
     *
     * @param {number} port
     * @returns {Promise<{ url: string, stop: () => Promise<void>, exited: Promise<{ reason: string, output: string }> }>}
     */
    async start(port) {
        const binaryPath = await this._cloudflaredBinary.resolve();
        const child = this._spawn(
            binaryPath,
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
        let log = '';
        const onLog = (chunk) => {
            log = (log + chunk).slice(-LOG_TAIL_LENGTH);
        };
        // This listener also keeps reading stderr, so cloudflared does not block on a full pipe.
        child.stderr.on('data', onLog);
        const lastLines = () => log.trim().split('\n').slice(-LOG_TAIL_LINES).join('\n');
        const exitInfo = exited.then(
            ([code, signal]) => ({ reason: signal || `code ${code}`, output: lastLines() }),
            (err) => ({ reason: err.message, output: lastLines() }),
        );
        let stopPromise;
        const stop = () => {
            stopPromise ??= (async () => {
                let killTimer;
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGTERM');
                    killTimer = setTimeout(() => child.kill('SIGKILL'), this._killTimeout);
                    killTimer.unref();
                }
                await exited.catch(() => {});
                clearTimeout(killTimer);
            })();
            return stopPromise;
        };

        let onUrl;
        let timer;
        try {
            const url = await new Promise((resolve, reject) => {
                onUrl = () => {
                    const match = log.match(TUNNEL_URL_PATTERN);
                    if (match) {
                        resolve(match[0]);
                    }
                };
                // Added after onLog, so `log` already has the chunk.
                child.stderr.on('data', onUrl);
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
                                ? new Error(
                                      `cloudflared was not found at ${binaryPath}. ${INSTALL_HINT}`,
                                  )
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
            return { url, stop, exited: exitInfo };
        } catch (err) {
            await stop();
            const output = lastLines();
            err.message += output ? `\ncloudflared output:\n${output}` : '';
            throw err;
        } finally {
            clearTimeout(timer);
            child.stderr.off('data', onUrl);
        }
    }
}

export { TunnelManager };
export default new TunnelManager();
