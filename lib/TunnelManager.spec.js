import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { jest } from '@jest/globals';
import { TunnelManager } from './TunnelManager.js';

const createChild = () => {
    const child = new EventEmitter();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = jest.fn((signal) => {
        child.signalCode = signal;
        child.emit('exit', null, signal);
    });
    return child;
};

const startTunnel = (options) => {
    const child = createChild();
    const spawn = jest.fn().mockReturnValue(child);
    const tunnel = new TunnelManager({ spawn, ...options }).start(3001);
    return { child, spawn, tunnel };
};

describe('TunnelManager', () => {
    it('starts cloudflared on the port and returns the URL from its log', async () => {
        const { child, spawn, tunnel } = startTunnel();

        child.stderr.write('INF Requesting new quick Tunnel...\nINF |  https://some-');
        child.stderr.write('words.trycloudflare.com  |\n');

        await expect(tunnel).resolves.toMatchObject({
            url: 'https://some-words.trycloudflare.com',
        });
        expect(spawn.mock.calls[0][1]).toEqual(
            expect.arrayContaining(['tunnel', '--url', 'http://localhost:3001']),
        );
    });

    it('reports a missing cloudflared binary', async () => {
        const { child, tunnel } = startTunnel();

        child.emit(
            'error',
            Object.assign(new Error('spawn cloudflared ENOENT'), { code: 'ENOENT' }),
        );

        await expect(tunnel).rejects.toThrow('cloudflared was not found. Install cloudflared');
    });

    it('reports an early exit with the cloudflared output', async () => {
        const { child, tunnel } = startTunnel();

        child.stderr.write('ERR failed to request quick Tunnel\n');
        await new Promise(setImmediate);
        child.emit('exit', 1, null);

        await expect(tunnel).rejects.toThrow(
            /exited \(code 1\)[\s\S]*ERR failed to request quick Tunnel/,
        );
    });

    it('stops cloudflared when no URL comes before the timeout', async () => {
        const { child, tunnel } = startTunnel({ startTimeout: 10 });

        await expect(tunnel).rejects.toThrow('did not return a tunnel URL after 0.01s');
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('stop() stops cloudflared once and can be called again', async () => {
        const { child, tunnel } = startTunnel();
        child.stderr.write('https://preview.trycloudflare.com');
        const { stop } = await tunnel;

        await Promise.all([stop(), stop()]);
        await stop();

        expect(child.kill).toHaveBeenCalledTimes(1);
    });
});
