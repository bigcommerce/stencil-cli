import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { jest } from '@jest/globals';
import * as tar from 'tar';
import tmp from 'tmp-promise';
import { CloudflaredBinary, INSTALL_URL } from './cloudflared-binary.js';

const VERSION = '2026.10.0';
const BINARY = Buffer.from('#!/bin/sh\necho fake cloudflared\n');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const enoent = () => Object.assign(new Error('spawn cloudflared ENOENT'), { code: 'ENOENT' });

describe('CloudflaredBinary', () => {
    let tmpDir;
    let home;

    beforeEach(async () => {
        tmpDir = await tmp.dir({ unsafeCleanup: true });
        home = tmpDir.path;
    });

    afterEach(async () => {
        await tmpDir.cleanup();
    });

    const linuxDir = () => path.join(home, '.cache', 'stencil-cli', 'cloudflared', VERSION);

    const create = ({ asset = BINARY, manifest, ...options } = {}) => {
        const httpClient = {
            get: jest.fn(async () => ({
                data: Readable.from([asset]),
                headers: { 'content-length': String(asset.length) },
            })),
        };
        const logger = { log: jest.fn() };
        const execFile = jest.fn().mockRejectedValue(enoent());
        const binary = new CloudflaredBinary({
            httpClient,
            execFile,
            logger,
            platform: 'linux',
            arch: 'x64',
            env: {},
            homedir: () => home,
            progressStream: { isTTY: false },
            manifest: manifest ?? {
                version: VERSION,
                assets: { 'linux-x64': { name: 'cloudflared-linux-amd64', sha256: sha256(asset) } },
            },
            ...options,
        });
        return { binary, httpClient, logger, execFile };
    };

    const writeCached = async (dir = linuxDir()) => {
        await fs.promises.mkdir(dir, { recursive: true });
        const file = path.join(dir, 'cloudflared');
        await fs.promises.writeFile(file, BINARY);
        return file;
    };

    it('uses STENCIL_CLOUDFLARED_PATH as-is', async () => {
        const { binary, execFile, httpClient } = create({
            env: { STENCIL_CLOUDFLARED_PATH: '/opt/cloudflared' },
        });

        await expect(binary.resolve()).resolves.toBe('/opt/cloudflared');
        expect(execFile).not.toHaveBeenCalled();
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('uses cloudflared on the PATH when it is new enough', async () => {
        const execFile = jest.fn().mockResolvedValue({
            stdout: 'cloudflared version 2026.10.0 (built 2026-10-01-1200 UTC)\n',
            stderr: '',
        });
        const { binary, httpClient } = create({ execFile });

        await expect(binary.resolve()).resolves.toBe('cloudflared');
        expect(execFile).toHaveBeenCalledWith('cloudflared', ['--version'], expect.any(Object));
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('uses the managed cloudflared when the one on the PATH is too old', async () => {
        const execFile = jest.fn().mockResolvedValue({
            stdout: 'cloudflared version 2024.1.5 (built 2024-01-22-1200 UTC)\n',
            stderr: '',
        });
        const { binary, httpClient, logger } = create({ execFile });
        const cached = await writeCached();

        await expect(binary.resolve()).resolves.toBe(cached);
        expect(logger.log).toHaveBeenCalledWith(
            expect.stringContaining('is version 2024.1.5, older than 2025.10.0'),
        );
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('uses the cached cloudflared when there is none on the PATH', async () => {
        const { binary, httpClient } = create();
        const cached = await writeCached();

        await expect(binary.resolve()).resolves.toBe(cached);
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('uses XDG_CACHE_HOME for the cache on Linux', async () => {
        const xdg = path.join(home, 'xdg');
        const { binary } = create({ env: { XDG_CACHE_HOME: xdg } });
        const cached = await writeCached(path.join(xdg, 'stencil-cli', 'cloudflared', VERSION));

        await expect(binary.resolve()).resolves.toBe(cached);
    });

    it('downloads, verifies, and installs the pinned binary', async () => {
        const { binary, httpClient, logger } = create();

        const result = await binary.resolve();

        expect(result).toBe(path.join(linuxDir(), 'cloudflared'));
        expect(httpClient.get).toHaveBeenCalledWith(
            `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-linux-amd64`,
            expect.objectContaining({ responseType: 'stream' }),
        );
        expect(logger.log).toHaveBeenCalledWith(
            `Downloading cloudflared ${VERSION} (first run only)...`,
        );
        expect(await fs.promises.readFile(result)).toEqual(BINARY);
        // eslint-disable-next-line no-bitwise
        expect((await fs.promises.stat(result)).mode & 0o777).toBe(0o755);
        expect(await fs.promises.readdir(linuxDir())).toEqual(['cloudflared']);
    });

    it('extracts cloudflared from a .tgz asset', async () => {
        const srcDir = path.join(home, 'src');
        await fs.promises.mkdir(srcDir);
        await fs.promises.writeFile(path.join(srcDir, 'cloudflared'), BINARY);
        await fs.promises.writeFile(path.join(srcDir, 'README'), 'not this');
        const archive = path.join(home, 'cloudflared-darwin-arm64.tgz');
        await tar.c({ gzip: true, file: archive, cwd: srcDir }, ['cloudflared', 'README']);
        const asset = await fs.promises.readFile(archive);
        const { binary } = create({
            asset,
            platform: 'darwin',
            arch: 'arm64',
            manifest: {
                version: VERSION,
                assets: {
                    'darwin-arm64': { name: 'cloudflared-darwin-arm64.tgz', sha256: sha256(asset) },
                },
            },
        });
        const dir = path.join(home, 'Library', 'Caches', 'stencil-cli', 'cloudflared', VERSION);

        const result = await binary.resolve();

        expect(result).toBe(path.join(dir, 'cloudflared'));
        expect(await fs.promises.readFile(result)).toEqual(BINARY);
        expect(await fs.promises.readdir(dir)).toEqual(['cloudflared']);
    });

    it('fails and leaves no file when the checksum does not match', async () => {
        const { binary } = create({
            manifest: {
                version: VERSION,
                assets: {
                    'linux-x64': { name: 'cloudflared-linux-amd64', sha256: 'f'.repeat(64) },
                },
            },
        });

        await expect(binary.resolve()).rejects.toThrow(/failed the checksum check/);
        expect(await fs.promises.readdir(linuxDir())).toEqual([]);
    });

    it('fails with the install hint on an unsupported platform', async () => {
        const { binary, httpClient } = create({ platform: 'aix', arch: 'ppc64' });

        await expect(binary.resolve()).rejects.toThrow(INSTALL_URL);
        await expect(binary.resolve()).rejects.toThrow('not available for aix/ppc64');
        expect(httpClient.get).not.toHaveBeenCalled();
    });

    it('tries again on the next call after a failed download', async () => {
        const { binary, httpClient } = create();
        const { get } = httpClient;
        const succeed = get.getMockImplementation();
        get.mockRejectedValueOnce(new Error('socket hang up')).mockImplementation(succeed);

        await expect(binary.resolve()).rejects.toThrow('socket hang up');
        await expect(binary.resolve()).resolves.toBe(path.join(linuxDir(), 'cloudflared'));
        expect(get).toHaveBeenCalledTimes(2);
    });

    describe('when the last rename fails', () => {
        const finalPath = () => path.join(linuxDir(), 'cloudflared');
        const busy = () => Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
        const withRename = (rename) => ({
            ...fs,
            promises: { ...fs.promises, rename },
        });

        it('uses the binary that another run installed first', async () => {
            const rename = jest.fn(async (from, to) => {
                if (to === finalPath()) {
                    await fs.promises.writeFile(to, BINARY);
                    throw busy();
                }
                return fs.promises.rename(from, to);
            });
            const { binary } = create({ fs: withRename(rename) });

            await expect(binary.resolve()).resolves.toBe(finalPath());
            expect(await fs.promises.readdir(linuxDir())).toEqual(['cloudflared']);
        });

        it('fails when no binary is at the final path', async () => {
            const rename = jest.fn(async (from, to) => {
                if (to === finalPath()) {
                    throw busy();
                }
                return fs.promises.rename(from, to);
            });
            const { binary } = create({ fs: withRename(rename) });

            await expect(binary.resolve()).rejects.toThrow(/Could not install cloudflared.*EBUSY/);
            expect(await fs.promises.readdir(linuxDir())).toEqual([]);
        });
    });

    it('downloads once for concurrent calls', async () => {
        const { binary, httpClient } = create();

        const results = await Promise.all([binary.resolve(), binary.resolve(), binary.resolve()]);

        expect(new Set(results)).toEqual(new Set([path.join(linuxDir(), 'cloudflared')]));
        expect(httpClient.get).toHaveBeenCalledTimes(1);
    });
});
