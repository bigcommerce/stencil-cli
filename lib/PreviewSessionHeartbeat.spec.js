import { jest } from '@jest/globals';
import PreviewSessionHeartbeat from './PreviewSessionHeartbeat.js';

const SECOND = 1000;
const error = (status, retryable = false) =>
    Object.assign(new Error(`HTTP ${status}`), { status, retryable });

describe('PreviewSessionHeartbeat', () => {
    let session;
    let client;
    let logger;
    let heartbeat;

    beforeEach(() => {
        jest.useFakeTimers();
        session = {
            storeUrl: 'https://store.example.com',
            tunnelUrl: 'https://preview.trycloudflare.com',
            secret: 's'.repeat(64),
            sessionId: 'session-1',
            accessKey: 'key-1',
            expiresIn: 300,
        };
        client = {
            heartbeat: jest.fn().mockResolvedValue({ expiresIn: 300 }),
            register: jest
                .fn()
                .mockResolvedValue({ sessionId: 'session-2', accessKey: 'key-2', expiresIn: 300 }),
        };
        logger = { log: jest.fn(), error: jest.fn() };
        heartbeat = new PreviewSessionHeartbeat({ client, session, accessToken: 'token', logger });
        heartbeat.start();
    });

    afterEach(() => {
        heartbeat.stop();
        jest.useRealTimers();
    });

    it('renews 60s before the TTL ends, so the session survives past its TTL', async () => {
        await jest.advanceTimersByTimeAsync(239 * SECOND);
        expect(client.heartbeat).not.toHaveBeenCalled();

        // 720s: past two TTLs.
        await jest.advanceTimersByTimeAsync(481 * SECOND);
        expect(client.heartbeat).toHaveBeenCalledTimes(3);
        expect(client.heartbeat).toHaveBeenCalledWith({
            storeUrl: session.storeUrl,
            accessToken: 'token',
            sessionId: 'session-1',
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('registers again with the same tunnel and secret when the session is gone', async () => {
        client.heartbeat.mockRejectedValueOnce(error(404));

        await jest.advanceTimersByTimeAsync(240 * SECOND);
        expect(client.register).toHaveBeenCalledWith({
            storeUrl: session.storeUrl,
            accessToken: 'token',
            tunnelUrl: session.tunnelUrl,
            secret: session.secret,
        });
        expect(session).toMatchObject({ sessionId: 'session-2', accessKey: 'key-2' });

        await jest.advanceTimersByTimeAsync(240 * SECOND);
        expect(client.heartbeat).toHaveBeenLastCalledWith(
            expect.objectContaining({ sessionId: 'session-2' }),
        );
    });

    it('backs off on repeated failures, warns once, and reports recovery', async () => {
        client.heartbeat
            .mockRejectedValueOnce(error(503, true))
            .mockRejectedValueOnce(error(503, true))
            .mockRejectedValueOnce(error(503, true));

        await jest.advanceTimersByTimeAsync(240 * SECOND);
        expect(logger.error).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(15 * SECOND);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error.mock.calls[0][0]).toContain('HTTP 503 Retrying in 30s.');
        await jest.advanceTimersByTimeAsync(30 * SECOND);
        expect(client.heartbeat).toHaveBeenCalledTimes(3);
        await jest.advanceTimersByTimeAsync(59 * SECOND);
        expect(client.heartbeat).toHaveBeenCalledTimes(3);
        await jest.advanceTimersByTimeAsync(1 * SECOND);
        expect(client.heartbeat).toHaveBeenCalledTimes(4);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith('The Makeswift preview session is renewed.');
    });

    it('retries a failed registration without another heartbeat', async () => {
        client.heartbeat.mockRejectedValueOnce(error(404));
        client.register.mockRejectedValueOnce(error(503, true));

        await jest.advanceTimersByTimeAsync((240 + 15) * SECOND);
        expect(client.heartbeat).toHaveBeenCalledTimes(1);
        expect(client.register).toHaveBeenCalledTimes(2);
        expect(session.sessionId).toBe('session-2');
    });

    it('shows the error and stops when the failure is not retryable', async () => {
        client.heartbeat.mockRejectedValueOnce(error(401));

        await jest.advanceTimersByTimeAsync(240 * SECOND);
        expect(logger.error.mock.calls[0][0]).toContain('HTTP 401');
        expect(jest.getTimerCount()).toBe(0);
    });

    it('does not register or schedule after stop() during a request', async () => {
        let reject;
        client.heartbeat.mockReturnValueOnce(
            new Promise((_, rej) => {
                reject = rej;
            }),
        );

        await jest.advanceTimersByTimeAsync(240 * SECOND);
        heartbeat.stop();
        reject(error(404));
        await jest.runAllTimersAsync();

        expect(client.register).not.toHaveBeenCalled();
        expect(session.sessionId).toBe('session-1');
        expect(jest.getTimerCount()).toBe(0);
    });
});
