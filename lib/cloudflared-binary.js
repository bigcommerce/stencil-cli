import 'colors';
import { execFile as nodeExecFile } from 'child_process';
import crypto from 'crypto';
import fsModule from 'fs';
import os from 'os';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import axios from 'axios';
import ProgressBar from 'progress';
import semver from 'semver';
import * as tar from 'tar';
import CLOUDFLARED_MANIFEST from './cloudflared-manifest.js';

// Cloudflare supports cloudflared releases for about one year. Raise this when bumping the pin.
const MIN_VERSION = '2025.10.0';
const PATH_ENV = 'STENCIL_CLOUDFLARED_PATH';
const DOWNLOAD_BASE_URL = 'https://github.com/cloudflare/cloudflared/releases/download';
const INSTALL_URL =
    'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';

/**
 * Finds a cloudflared binary for Makeswift preview. Downloads a pinned release on first use.
 */
class CloudflaredBinary {
    constructor({
        fs = fsModule,
        httpClient = axios,
        execFile = promisify(nodeExecFile),
        platform = process.platform,
        arch = process.arch,
        env = process.env,
        homedir = os.homedir,
        logger = console,
        progressStream = process.stderr,
        manifest = CLOUDFLARED_MANIFEST,
        minVersion = MIN_VERSION,
    } = {}) {
        this._fs = fs;
        this._httpClient = httpClient;
        this._execFile = execFile;
        this._platform = platform;
        this._arch = arch;
        this._env = env;
        this._homedir = homedir;
        this._logger = logger;
        this._progressStream = progressStream;
        this._manifest = manifest;
        this._minVersion = minVersion;
        this._resolvePromise = null;
    }

    /**
     * Concurrent calls share one lookup and one download.
     *
     * @returns {Promise<string>} absolute path or command name for cloudflared
     */
    resolve() {
        this._resolvePromise ??= this._resolve().catch((err) => {
            // Let a later call try again.
            this._resolvePromise = null;
            throw err;
        });
        return this._resolvePromise;
    }

    async _resolve() {
        const override = this._env[PATH_ENV];
        if (override) {
            return override;
        }
        if (await this._isPathBinaryUsable()) {
            return 'cloudflared';
        }
        const asset = this._manifest.assets[`${this._platform}-${this._arch}`];
        if (!asset) {
            throw new Error(
                `cloudflared is not available for ${this._platform}/${this._arch}. ` +
                    `Install cloudflared and set ${PATH_ENV} to its path: ${INSTALL_URL}`,
            );
        }
        const binaryPath = path.join(
            this._getCacheDir(),
            'stencil-cli',
            'cloudflared',
            this._manifest.version,
            this._platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
        );
        if (await this._isFile(binaryPath)) {
            return binaryPath;
        }
        await this._download(asset, binaryPath);
        return binaryPath;
    }

    async _isPathBinaryUsable() {
        let output;
        try {
            const { stdout, stderr } = await this._execFile('cloudflared', ['--version'], {
                timeout: 10000,
            });
            output = `${stdout}${stderr}`;
        } catch {
            return false;
        }
        const match = output.match(/cloudflared version (\S+)/);
        const version = match && semver.coerce(match[1]);
        if (version && semver.gte(version, this._minVersion)) {
            return true;
        }
        const reason = version
            ? `is version ${match[1]}, older than ${this._minVersion}`
            : 'has an unknown version';
        this._logger.log(
            `${'Notice'.yellow}: cloudflared on your PATH ${reason}. ` +
                `Using cloudflared ${this._manifest.version} managed by stencil-cli.`,
        );
        return false;
    }

    _getCacheDir() {
        const home = this._homedir();
        if (this._platform === 'darwin') {
            return path.join(home, 'Library', 'Caches');
        }
        if (this._platform === 'win32') {
            return this._env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
        }
        return this._env.XDG_CACHE_HOME || path.join(home, '.cache');
    }

    async _isFile(filePath) {
        try {
            return (await this._fs.promises.stat(filePath)).isFile();
        } catch {
            return false;
        }
    }

    async _download(asset, binaryPath) {
        const { version } = this._manifest;
        const url = `${DOWNLOAD_BASE_URL}/${version}/${asset.name}`;
        const dir = path.dirname(binaryPath);
        // Unique temp names, so concurrent `stencil start` runs do not collide.
        const suffix = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
        const tmpAsset = path.join(dir, `.${asset.name}.${suffix}.download`);
        const tmpExtractDir = path.join(dir, `.extract.${suffix}`);
        const tmpBinary = path.join(dir, `.${path.basename(binaryPath)}.${suffix}.tmp`);

        this._logger.log(`Downloading cloudflared ${version} (first run only)...`);
        try {
            await this._fs.promises.mkdir(dir, { recursive: true });
            const digest = await this._fetch(url, tmpAsset);
            if (digest !== asset.sha256) {
                throw new Error(
                    `The cloudflared download from ${url} failed the checksum check ` +
                        `(expected sha256 ${asset.sha256}, got ${digest}).`,
                );
            }
            if (asset.name.endsWith('.tgz')) {
                await this._extract(tmpAsset, tmpExtractDir, tmpBinary);
            } else {
                await this._fs.promises.rename(tmpAsset, tmpBinary);
            }
            if (this._platform !== 'win32') {
                await this._fs.promises.chmod(tmpBinary, 0o755);
            }
            try {
                await this._fs.promises.rename(tmpBinary, binaryPath);
            } catch (err) {
                // Another run can install it first. On Windows, rename fails if that file is in use.
                if (!(await this._isFile(binaryPath))) {
                    throw err;
                }
            }
        } catch (err) {
            err.message =
                `Could not install cloudflared ${version}. ${err.message} ` +
                `To use your own cloudflared, set ${PATH_ENV} to its path.`;
            throw err;
        } finally {
            await Promise.all(
                [tmpAsset, tmpExtractDir, tmpBinary].map((p) =>
                    this._fs.promises.rm(p, { recursive: true, force: true }).catch(() => {}),
                ),
            );
        }
    }

    /**
     * Streams the URL to a file and returns the sha256 hex digest.
     */
    async _fetch(url, filePath) {
        const response = await this._httpClient.get(url, {
            responseType: 'stream',
            timeout: 60000,
        });
        const hash = crypto.createHash('sha256');
        const total = Number(response.headers?.['content-length']);
        const bar =
            this._progressStream?.isTTY && total > 0
                ? new ProgressBar('cloudflared [:bar] :percent', {
                      total,
                      width: 30,
                      stream: this._progressStream,
                  })
                : null;
        const hasher = new Transform({
            transform(chunk, encoding, callback) {
                hash.update(chunk);
                bar?.tick(chunk.length);
                callback(null, chunk);
            },
        });
        await pipeline(response.data, hasher, this._fs.createWriteStream(filePath));
        return hash.digest('hex');
    }

    async _extract(archivePath, extractDir, binaryPath) {
        await this._fs.promises.mkdir(extractDir, { recursive: true });
        await tar.x({
            file: archivePath,
            cwd: extractDir,
            filter: (entryPath) => entryPath.replace(/^\.\//, '') === 'cloudflared',
        });
        const extracted = path.join(extractDir, 'cloudflared');
        if (!(await this._isFile(extracted))) {
            throw new Error('The cloudflared archive does not contain a cloudflared file.');
        }
        await this._fs.promises.rename(extracted, binaryPath);
    }
}

export { CloudflaredBinary, INSTALL_URL, MIN_VERSION, PATH_ENV };
export default new CloudflaredBinary();
