const path = require('path');
const StencilConfigManager = require('./StencilConfigManager');

const defaultThemePath = './test/_mocks/themes/valid/';
const defaultOldConfigPath = path.join(defaultThemePath, '.stencil');
const defaultConfigPath = path.join(defaultThemePath, 'config.stencil.json');
const defaultSecretsPath = path.join(defaultThemePath, 'secrets.stencil.json');
const getGeneralConfig = () => ({
    customLayouts: {
        brand: {
            a: 'aaaa',
        },
        category: {},
        page: {
            b: 'bbbb',
        },
        product: {},
    },
    apiHost: 'https://api.bigcommerce.com',
    normalStoreUrl: 'https://url-from-stencilConfig.mybigcommerce.com',
    port: 3001,
});
const getSecretsConfig = () => ({
    accessToken: 'accessToken_from_stencilConfig',
    githubToken: 'githubToken_1234567890',
});
const getStencilConfig = () => ({
    ...getGeneralConfig(),
    ...getSecretsConfig(),
});
const getFsStub = () => ({
    promises: {
        unlink: jest.fn(),
        writeFile: jest.fn(),
    },
    existsSync: jest.fn(),
});
const getFsUtilsStub = () => ({
    parseJsonFile: jest.fn().mockImplementation((filePath) => {
        if (filePath === defaultConfigPath) return getGeneralConfig();
        if (filePath === defaultSecretsPath) return getSecretsConfig();
        return getStencilConfig();
    }),
});
const getLoggerStub = () => ({
    log: jest.fn(),
    error: jest.fn(),
});

const createStencilConfigManagerInstance = ({ themePath, fs, fsUtils, logger } = {}) => {
    const passedArgs = {
        themePath: themePath || defaultThemePath,
        fs: fs || getFsStub(),
        fsUtils: fsUtils || getFsUtilsStub(),
        logger: logger || getLoggerStub(),
    };
    const instance = new StencilConfigManager(passedArgs);

    return {
        passedArgs,
        instance,
    };
};

afterEach(() => jest.resetAllMocks());

describe('StencilConfigManager unit tests', () => {
    describe('constructor', () => {
        it('should create an instance of StencilConfigManager without options parameters passed', async () => {
            const instance = new StencilConfigManager();

            expect(instance).toBeInstanceOf(StencilConfigManager);
        });

        it('should create an instance of StencilConfigManager with all options parameters passed', async () => {
            const { instance } = createStencilConfigManagerInstance();

            expect(instance).toBeInstanceOf(StencilConfigManager);
        });
    });

    describe('read', () => {
        describe('when no config files exit', () => {
            it('should return null if ignoreFileNotExists == true', async () => {
                const fsStub = getFsStub();
                fsStub.existsSync.mockReturnValue(false);

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                });
                const res = await instance.read(true);

                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
                expect(res).toBeNull();
            });

            it('should throw an error if ignoreFileNotExists == false', async () => {
                const fsStub = getFsStub();
                fsStub.existsSync.mockReturnValue(false);

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                });

                await expect(() => instance.read(false)).rejects.toThrow(
                    'Please run'.red + ' $ stencil init'.cyan + ' first.'.red,
                );
                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
            });
        });

        describe('when an old config file exists', () => {
            it('should replace an old config file with new ones and return the parsed config if it is valid', async () => {
                const loggerStub = getLoggerStub();
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation(
                    (filePath) => filePath === defaultOldConfigPath,
                );

                const { instance } = createStencilConfigManagerInstance({
                    logger: loggerStub,
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                const saveStencilConfigSpy = jest.spyOn(instance, 'save');
                const res = await instance.read();

                expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);

                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(1);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultOldConfigPath);

                expect(loggerStub.log).toHaveBeenCalledTimes(2);
                expect(loggerStub.log).toHaveBeenCalledWith(
                    expect.stringMatching(`will be replaced`),
                );
                expect(loggerStub.log).toHaveBeenCalledWith(
                    expect.stringMatching(`was successfully replaced`),
                );

                expect(saveStencilConfigSpy).toHaveBeenCalledTimes(1);
                expect(saveStencilConfigSpy).toHaveBeenCalledWith(getStencilConfig());

                expect(res).toEqual(getStencilConfig());
            });

            it('should replace an old config file with new ones and throw an error then if the parsed config is broken', async () => {
                const loggerStub = getLoggerStub();
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation(
                    (filePath) => filePath === defaultOldConfigPath,
                );
                fsUtilsStub.parseJsonFile.mockRejectedValue(new Error('kinda broken json file'));

                const { instance } = createStencilConfigManagerInstance({
                    logger: loggerStub,
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                const saveStencilConfigSpy = jest.spyOn(instance, 'save');

                await expect(() => instance.read()).rejects.toThrow(
                    // Should ignore the error above about a broken file and throw an error about missing fields
                    'Your stencil config is outdated',
                );

                expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);

                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(1);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultOldConfigPath);

                expect(loggerStub.log).toHaveBeenCalledTimes(2);
                expect(loggerStub.log).toHaveBeenCalledWith(
                    expect.stringMatching(`will be replaced`),
                );
                expect(loggerStub.log).toHaveBeenCalledWith(
                    expect.stringMatching(`was successfully replaced`),
                );

                expect(saveStencilConfigSpy).toHaveBeenCalledTimes(1);
                expect(saveStencilConfigSpy).toHaveBeenCalledWith({});
            });

            describe('when the parsed config has missing required fields', () => {
                const getConfigWithMissingFields = () => ({
                    port: 12345,
                });

                it('should replace an old config file with new ones and throw an error then if ignoreMissingFields=false', async () => {
                    const stencilConfig = getConfigWithMissingFields();
                    const loggerStub = getLoggerStub();
                    const fsStub = getFsStub();
                    fsStub.existsSync.mockImplementation(
                        (filePath) => filePath === defaultOldConfigPath,
                    );
                    const fsUtilsStub = getFsUtilsStub();
                    fsUtilsStub.parseJsonFile.mockResolvedValue(stencilConfig);

                    const { instance } = createStencilConfigManagerInstance({
                        logger: loggerStub,
                        fs: fsStub,
                        fsUtils: fsUtilsStub,
                    });
                    const saveStencilConfigSpy = jest.spyOn(instance, 'save');

                    await expect(() => instance.read(false, false)).rejects.toThrow(
                        'Your stencil config is outdated',
                    );

                    expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
                    expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);

                    expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(1);
                    expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultOldConfigPath);

                    expect(loggerStub.log).toHaveBeenCalledTimes(2);
                    expect(loggerStub.log).toHaveBeenCalledWith(
                        expect.stringMatching(`will be replaced`),
                    );
                    expect(loggerStub.log).toHaveBeenCalledWith(
                        expect.stringMatching(`was successfully replaced`),
                    );

                    expect(saveStencilConfigSpy).toHaveBeenCalledTimes(1);
                    expect(saveStencilConfigSpy).toHaveBeenCalledWith(stencilConfig);
                });

                it('should replace an old config file with new ones and return parsed config if ignoreMissingFields=true', async () => {
                    const stencilConfig = getConfigWithMissingFields();
                    const loggerStub = getLoggerStub();
                    const fsStub = getFsStub();
                    fsStub.existsSync.mockImplementation(
                        (filePath) => filePath === defaultOldConfigPath,
                    );
                    const fsUtilsStub = getFsUtilsStub();
                    fsUtilsStub.parseJsonFile.mockResolvedValue(stencilConfig);

                    const { instance } = createStencilConfigManagerInstance({
                        logger: loggerStub,
                        fs: fsStub,
                        fsUtils: fsUtilsStub,
                    });
                    const saveStencilConfigSpy = jest.spyOn(instance, 'save');
                    const res = await instance.read(false, true);

                    expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
                    expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);

                    expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(1);
                    expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultOldConfigPath);

                    expect(loggerStub.log).toHaveBeenCalledTimes(3);
                    expect(loggerStub.log).toHaveBeenCalledWith(
                        expect.stringMatching(`will be replaced`),
                    );
                    expect(loggerStub.log).toHaveBeenCalledWith(
                        expect.stringMatching(`was successfully replaced`),
                    );

                    expect(saveStencilConfigSpy).toHaveBeenCalledTimes(1);
                    expect(saveStencilConfigSpy).toHaveBeenCalledWith(stencilConfig);

                    expect(res).toEqual(stencilConfig);
                });
            });
        });

        describe('whe the new config files exist and an old config file do not exist', () => {
            it('should read the config files and return the parsed result if both secrets and general config files exist and valid', async () => {
                const generalConfig = getGeneralConfig();
                const secretsConfig = getSecretsConfig();
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation(
                    (filePath) => filePath !== defaultOldConfigPath,
                );

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                const res = await instance.read();

                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultSecretsPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(2);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultSecretsPath);

                expect(res).toEqual({ ...generalConfig, ...secretsConfig });
            });

            it("should read general config if it exists and skip secrets config if it doesn't exist and return the parsed result", async () => {
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation((filePath) => filePath === defaultConfigPath);

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                const res = await instance.read();

                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultSecretsPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(1);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultConfigPath);

                expect(res).toEqual(getGeneralConfig());
            });

            it('should throw an error if the parsed config does not contain normalStoreUrl', async () => {
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation(
                    (filePath) => filePath !== defaultOldConfigPath,
                );
                fsUtilsStub.parseJsonFile.mockImplementation((filePath) => {
                    const generalConfig = getGeneralConfig();
                    delete generalConfig.normalStoreUrl;

                    if (filePath === defaultConfigPath) return generalConfig;
                    return getSecretsConfig();
                });

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                await expect(() => instance.read()).rejects.toThrow(
                    'Your stencil config is outdated',
                );

                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultSecretsPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(2);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultSecretsPath);
            });

            it('should throw an error if the parsed config does not contain customLayouts', async () => {
                const fsStub = getFsStub();
                const fsUtilsStub = getFsUtilsStub();
                fsStub.existsSync.mockImplementation(
                    (filePath) => filePath !== defaultOldConfigPath,
                );
                fsUtilsStub.parseJsonFile.mockImplementation((filePath) => {
                    const generalConfig = getGeneralConfig();
                    delete generalConfig.customLayouts;

                    if (filePath === defaultConfigPath) return generalConfig;
                    return getSecretsConfig();
                });

                const { instance } = createStencilConfigManagerInstance({
                    fs: fsStub,
                    fsUtils: fsUtilsStub,
                });
                await expect(() => instance.read()).rejects.toThrow(
                    'Your stencil config is outdated',
                );

                expect(fsStub.existsSync).toHaveBeenCalledTimes(3);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultOldConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsStub.existsSync).toHaveBeenCalledWith(defaultSecretsPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledTimes(2);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultConfigPath);
                expect(fsUtilsStub.parseJsonFile).toHaveBeenCalledWith(defaultSecretsPath);
            });
        });
    });

    describe('save', () => {
        it('should call fs.writeFile with the serialized configs for secrets and general config fields', async () => {
            const stencilConfig = getStencilConfig();
            const serializedGeneralConfig = JSON.stringify(getGeneralConfig(), null, 2);
            const serializedSecretsConfig = JSON.stringify(getSecretsConfig(), null, 2);
            const fsStub = getFsStub();

            const { instance } = createStencilConfigManagerInstance({
                fs: fsStub,
            });
            await instance.save(stencilConfig);

            expect(fsStub.promises.writeFile).toHaveBeenCalledTimes(2);
            expect(fsStub.promises.writeFile).toHaveBeenCalledWith(
                defaultConfigPath,
                serializedGeneralConfig,
            );
            expect(fsStub.promises.writeFile).toHaveBeenCalledWith(
                defaultSecretsPath,
                serializedSecretsConfig,
            );
        });
    });
});
