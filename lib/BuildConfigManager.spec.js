import fs from 'fs/promises';
import { jest } from '@jest/globals';
import { promisify } from 'util';
import BuildConfigManager from './BuildConfigManager.js';

const cwd = process.cwd();
describe('BuildConfigManager integration tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('constructor', () => {
        it('should return an instance with correct watchOptions taken from the config file', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/valid-config`,
            });
            await buildConfig.initConfig();
            expect(buildConfig.watchOptions).toBeInstanceOf(Object);
            expect(buildConfig.watchOptions.files).toBeInstanceOf(Array);
            expect(buildConfig.watchOptions.ignored).toBeInstanceOf(Array);
        });
    });
    describe('production method', () => {
        it('should resolve successfully for "valid-config"', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/valid-config`,
            });
            await buildConfig.initConfig();
            buildConfig.initWorker();
            expect(buildConfig.production).toBeInstanceOf(Function);
            await promisify(buildConfig.production.bind(buildConfig))();
            buildConfig.stopWorker();
        });
        it('should resolve successfully for "legacy-config"', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/legacy-config`,
            });
            await buildConfig.initConfig();
            buildConfig.initWorker();
            expect(buildConfig.production).toBeInstanceOf(Function);
            await promisify(buildConfig.production.bind(buildConfig))();
            buildConfig.stopWorker();
        });
        it('should reject with "worker terminated" message for "noworker-config"', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/noworker-config`,
            });
            await buildConfig.initConfig();
            const initedBuildConfig = buildConfig.initWorker();
            expect(buildConfig.production).toBeInstanceOf(Function);
            await expect(
                promisify(initedBuildConfig.production.bind(initedBuildConfig))(),
            ).rejects.toContain('worker terminated');
            buildConfig.stopWorker();
        });
        it('should download config from cornerstone github', async () => {
            const workDir = `${cwd}/test/_mocks/build-config/no-config`;
            const buildConfig = new BuildConfigManager({
                workDir,
            });
            try {
                await fs.access(workDir);
            } catch (e) {
                await fs.mkdir(workDir, { recursive: true });
            }
            await buildConfig.initConfig();
            buildConfig.initWorker();
            expect(buildConfig.production).toBeInstanceOf(Function);
            await promisify(buildConfig.production.bind(buildConfig))();
            buildConfig.stopWorker();
            await fs.rm(`${cwd}/test/_mocks/build-config/no-config/stencil.conf.cjs`);
        });
    });
    describe('development method', () => {
        it('should reload the browser when a message "reload" is received from stencil.conf.js (valid-config)', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/valid-config`,
            });
            await buildConfig.initConfig();
            expect(buildConfig.development).toBeInstanceOf(Function);
            await new Promise((done) => buildConfig.initWorker().development({ reload: done }));
            buildConfig.stopWorker();
        });
        it('should reload the browser when "reload" method is called from stencil.conf.js (legacy-config)', async () => {
            const buildConfig = new BuildConfigManager({
                workDir: `${cwd}/test/_mocks/build-config/legacy-config`,
            });
            await buildConfig.initConfig();
            expect(buildConfig.development).toBeInstanceOf(Function);
            await new Promise((done) => buildConfig.initWorker().development({ reload: done }));
            buildConfig.stopWorker();
        });
    });
});
