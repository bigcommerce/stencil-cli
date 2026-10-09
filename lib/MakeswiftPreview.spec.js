import { jest } from '@jest/globals';
import MakeswiftPreview from './MakeswiftPreview.js';

describe('MakeswiftPreview', () => {
    const localPort = 3000;
    const rendererPort = 3001;
    const storeUrl = 'https://www.example.com';
    const accessToken = 'token-123';
    const tunnelUrl = 'https://preview-123.trycloudflare.com';
    const previewSecret = 's'.repeat(64);
    const registeredSession = {
        sessionId: '0b6f9c3e-4d2a-4f7b-9a1c-2e3d4f5a6b7c',
        accessKey: 'k'.repeat(64),
        expiresIn: 300,
    };
    const previewProxyMiddleware = jest.fn();

    const getTunnelManagerStub = () => ({
        start: jest.fn().mockResolvedValue({ url: tunnelUrl, stop: jest.fn().mockResolvedValue() }),
    });
    const getPreviewSessionClientStub = () => ({
        createSecret: jest.fn().mockReturnValue(previewSecret),
        register: jest.fn().mockResolvedValue(registeredSession),
        revoke: jest.fn().mockResolvedValue(),
    });

    const createPreview = ({
        makeswiftActive = true,
        tunnelManager = getTunnelManagerStub(),
        previewSessionClient = getPreviewSessionClientStub(),
        shutdownTimeout,
    } = {}) => {
        const deps = {
            makeswiftProxyHealth: {
                isMakeswiftProxyActive: jest.fn().mockResolvedValue(makeswiftActive),
            },
            tunnelManager,
            previewSessionClient,
            previewProxyFactory: jest.fn().mockReturnValue(previewProxyMiddleware),
            previewSessionHeartbeatFactory: jest
                .fn()
                .mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
            processObj: { on: jest.fn(), once: jest.fn(), exit: jest.fn() },
            logger: { log: jest.fn(), error: jest.fn() },
            shutdownTimeout,
        };
        const preview = new MakeswiftPreview(deps);
        const output = () =>
            [...deps.logger.log.mock.calls, ...deps.logger.error.mock.calls].flat().join('\n');
        return { ...deps, preview, output };
    };

    const startPreview = async (options) => {
        const context = createPreview(options);
        await context.preview.start({ localPort, rendererPort, storeUrl, accessToken });
        return context;
    };

    const signalHandler = (processObj, signal) =>
        processObj.on.mock.calls.find(([name]) => name === signal)[1];

    describe('isEnabled', () => {
        it('should be true when the storefront is routed through the Makeswift proxy', async () => {
            const { preview, makeswiftProxyHealth, output } = createPreview();
            await expect(preview.isEnabled({ storeUrl })).resolves.toBe(true);
            expect(makeswiftProxyHealth.isMakeswiftProxyActive).toHaveBeenCalledWith({
                storeUrl,
            });
            expect(output()).toBe('');
        });

        it('should be false when Makeswift is not active', async () => {
            const { preview, output } = createPreview({ makeswiftActive: false });
            await expect(preview.isEnabled({ storeUrl, tunnel: true })).resolves.toBe(false);
            expect(output()).toBe('');
        });

        it('should be false with a notice when --tunnel is set', async () => {
            const { preview, output } = createPreview();
            await expect(preview.isEnabled({ storeUrl, tunnel: true })).resolves.toBe(false);
            expect(output()).toContain('Makeswift preview is off because --tunnel is set');
        });
    });

    describe('start', () => {
        it('should start a tunnel to the renderer port and print the local front door', async () => {
            const { tunnelManager, output } = await startPreview();
            expect(tunnelManager.start).toHaveBeenCalledWith(rendererPort);
            expect(output()).toContain('Makeswift preview is active. Open');
            expect(output()).toContain(`http://localhost:${localPort}`);
            expect(output()).not.toContain(tunnelUrl);
            expect(output()).not.toContain(previewSecret);
            expect(output()).not.toContain(registeredSession.accessKey);
        });

        it('should register the session with a new secret', async () => {
            const { previewSessionClient, preview } = await startPreview();
            expect(previewSessionClient.register).toHaveBeenCalledWith({
                storeUrl,
                accessToken,
                tunnelUrl,
                secret: previewSecret,
            });
            expect(preview.session).toEqual({
                storeUrl,
                tunnelUrl,
                secret: previewSecret,
                ...registeredSession,
            });
        });

        it('should keep the registered session alive with a heartbeat', async () => {
            const {
                previewSessionHeartbeatFactory,
                previewSessionClient,
                logger,
                preview,
            } = await startPreview();
            expect(previewSessionHeartbeatFactory).toHaveBeenCalledWith({
                client: previewSessionClient,
                session: preview.session,
                accessToken,
                logger,
            });
            expect(previewSessionHeartbeatFactory.mock.results[0].value.start).toHaveBeenCalled();
        });

        it('should fail when there is no access token', async () => {
            const { preview, tunnelManager } = createPreview();
            await expect(
                preview.start({ localPort, rendererPort, storeUrl, accessToken: null }),
            ).rejects.toThrow('Makeswift preview requires an access token');
            expect(tunnelManager.start).not.toHaveBeenCalled();
        });

        it('should continue without a session when the tunnel fails', async () => {
            const tunnelManager = {
                start: jest.fn().mockRejectedValue(new Error('cloudflared was not found.')),
            };
            const { preview, processObj, output } = await startPreview({ tunnelManager });
            expect(output()).toContain(
                'Makeswift preview is not available. cloudflared was not found.',
            );
            expect(processObj.on).not.toHaveBeenCalled();
            expect(preview.session).toBeNull();
        });

        it('should stop the tunnel and continue without a session when registration fails', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.register.mockRejectedValue(
                new Error('Could not register the Makeswift preview session (HTTP 401).'),
            );
            const {
                tunnelManager,
                preview,
                output,
                previewSessionHeartbeatFactory,
            } = await startPreview({ previewSessionClient });
            const { stop } = await tunnelManager.start.mock.results[0].value;
            expect(stop).toHaveBeenCalled();
            expect(previewSessionHeartbeatFactory).not.toHaveBeenCalled();
            expect(preview.session).toBeNull();
            expect(previewSessionClient.revoke).not.toHaveBeenCalled();
            expect(output()).toContain('Makeswift preview is not available. Could not register');
        });
    });

    describe('getBrowserSyncOptions', () => {
        it('should serve a signing proxy to the storefront on loopback only', async () => {
            const { preview, previewProxyFactory, logger } = await startPreview();
            expect(preview.getBrowserSyncOptions()).toEqual({
                listen: 'localhost',
                server: { baseDir: [] },
                middleware: [previewProxyMiddleware],
                tunnel: false,
            });
            expect(previewProxyFactory).toHaveBeenCalledWith({
                previewSession: preview.session,
                logger,
            });
        });
    });

    describe('shutdown', () => {
        it('should stop the heartbeat and tunnel, revoke the session, and exit on SIGINT', async () => {
            const {
                tunnelManager,
                processObj,
                previewSessionClient,
                previewSessionHeartbeatFactory,
            } = await startPreview();
            const { stop } = await tunnelManager.start.mock.results[0].value;

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(previewSessionHeartbeatFactory.mock.results[0].value.stop).toHaveBeenCalled();
            expect(stop).toHaveBeenCalledTimes(1);
            expect(previewSessionClient.revoke).toHaveBeenCalledWith({
                storeUrl,
                accessToken,
                sessionId: registeredSession.sessionId,
            });
            expect(processObj.exit).toHaveBeenCalledWith(130);
        });

        it('should exit with 143 on SIGTERM', async () => {
            const { processObj } = await startPreview();

            await signalHandler(processObj, 'SIGTERM')('SIGTERM');

            expect(processObj.exit).toHaveBeenCalledWith(143);
        });

        it('should exit at once on a second signal while cleanup runs, and clean up only once', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockReturnValue(new Promise(() => {}));
            const { tunnelManager, processObj } = await startPreview({
                previewSessionClient,
                shutdownTimeout: 10,
            });
            const { stop } = await tunnelManager.start.mock.results[0].value;

            signalHandler(processObj, 'SIGINT')('SIGINT');
            await signalHandler(processObj, 'SIGTERM')('SIGTERM');

            expect(processObj.exit).toHaveBeenCalledTimes(1);
            expect(processObj.exit).toHaveBeenCalledWith(1);
            expect(previewSessionClient.revoke).toHaveBeenCalledTimes(1);
            expect(stop).toHaveBeenCalledTimes(1);
        });

        it('should stop the tunnel and exit without output when the revoke fails', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockRejectedValue(
                new Error('Could not revoke the Makeswift preview session (HTTP 503).'),
            );
            const { tunnelManager, processObj, logger } = await startPreview({
                previewSessionClient,
            });
            const { stop } = await tunnelManager.start.mock.results[0].value;
            logger.log.mockClear();
            logger.error.mockClear();

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(stop).toHaveBeenCalled();
            expect(processObj.exit).toHaveBeenCalledWith(130);
            expect(logger.log).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should exit after the shutdown timeout when the revoke does not complete', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockReturnValue(new Promise(() => {}));
            const { processObj } = await startPreview({
                previewSessionClient,
                shutdownTimeout: 10,
            });

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(processObj.exit).toHaveBeenCalledWith(130);
        });

        it('should only stop the tunnel on a process exit that is not a signal', async () => {
            const { tunnelManager, processObj, previewSessionClient } = await startPreview();
            const { stop } = await tunnelManager.start.mock.results[0].value;
            const onExit = processObj.once.mock.calls.find(([name]) => name === 'exit')[1];

            onExit();

            expect(stop).toHaveBeenCalled();
            expect(previewSessionClient.revoke).not.toHaveBeenCalled();
        });

        it('should revoke only once when called more than once', async () => {
            const { preview, previewSessionClient } = await startPreview();

            await Promise.all([preview.shutdown(), preview.shutdown()]);

            expect(previewSessionClient.revoke).toHaveBeenCalledTimes(1);
        });

        it('should not revoke when there is no session', async () => {
            const { preview, previewSessionClient } = createPreview();

            await preview.shutdown();

            expect(previewSessionClient.revoke).not.toHaveBeenCalled();
        });
    });
});
