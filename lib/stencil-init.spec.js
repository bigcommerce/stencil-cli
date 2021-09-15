const _ = require('lodash');
const inquirerModule = require('inquirer');

const StencilInit = require('./stencil-init');
const StencilConfigManager = require('./StencilConfigManager');
const { DEFAULT_CUSTOM_LAYOUTS_CONFIG, API_HOST } = require('../constants');
const { assertNoMutations } = require('../test/assertions/assertNoMutations');

const getStencilConfig = () => ({
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
    normalStoreUrl: 'https://url-from-stencilConfig.mybigcommerce.com',
    port: 3001,
    accessToken: 'accessToken_from_stencilConfig',
    githubToken: 'githubToken_1234567890',
    apiHost: API_HOST,
});
const getAnswers = () => ({
    normalStoreUrl: 'https://url-from-answers.mybigcommerce.com',
    port: 3003,
    accessToken: 'accessToken_from_answers',
});
const getCliOptions = () => ({
    normalStoreUrl: 'https://url-from-cli-options.mybigcommerce.com',
    port: 3002,
    accessToken: 'accessToken_from_CLI_options',
});
const getQuestions = () => [
    {
        type: 'input',
        name: 'normalStoreUrl',
        message: "What is the URL of your store's home page?",
        validate: (val) => /^https?:\/\//.test(val) || 'You must enter a URL',
        default: 'https://url-from-answers.mybigcommerce.com',
    },
    {
        type: 'input',
        name: 'accessToken',
        message: 'What is your Stencil OAuth Access Token?',
        default: 'accessToken_from_answers',
        filter: (val) => val.trim(),
    },
    {
        type: 'input',
        name: 'port',
        message: 'What port would you like to run the server on?',
        default: 3003,
        validate: (val) => {
            if (Number.isNaN(val)) {
                return 'You must enter an integer';
            }
            if (val < 1024 || val > 65535) {
                return 'The port number must be between 1025 and 65535';
            }
            return true;
        },
    },
];

afterEach(() => jest.restoreAllMocks());

describe('StencilInit integration tests', () => {
    describe('run', () => {
        it('using cli prompts, should perform all the actions, save the result and inform the user about the successful finish', async () => {
            const answers = getAnswers();
            const expectedResult = {
                customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG,
                ...answers,
                apiHost: API_HOST,
            };
            const stencilConfigManager = new StencilConfigManager({
                themePath: './test/_mocks/themes/valid/',
            });
            const saveStencilConfigStub = jest
                .spyOn(stencilConfigManager, 'save')
                .mockImplementation(jest.fn());
            const inquirerPromptStub = jest
                .spyOn(inquirerModule, 'prompt')
                .mockReturnValue(answers);
            const consoleErrorStub = jest.spyOn(console, 'error').mockImplementation(jest.fn());
            const consoleLogStub = jest.spyOn(console, 'log').mockImplementation(jest.fn());

            // Test with real entities, just some methods stubbed
            const instance = new StencilInit({
                inquirer: inquirerModule,
                stencilConfigManager,
                logger: console,
            });
            await instance.run();

            expect(inquirerPromptStub).toHaveBeenCalledTimes(1);
            expect(consoleErrorStub).toHaveBeenCalledTimes(0);
            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(saveStencilConfigStub).toHaveBeenCalledTimes(1);

            expect(saveStencilConfigStub).toHaveBeenCalledWith(expectedResult);
            expect(consoleLogStub).toHaveBeenCalledWith(
                'You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan,
            );
        });

        it('using cli options, should perform all the actions, save the result and inform the user about the successful finish', async () => {
            const cliOptions = getCliOptions();
            const expectedResult = {
                customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG,
                ...cliOptions,
                apiHost: API_HOST,
            };
            const stencilConfigManager = new StencilConfigManager({
                themePath: './test/_mocks/themes/valid/',
            });
            const saveStencilConfigStub = jest
                .spyOn(stencilConfigManager, 'save')
                .mockImplementation(jest.fn());
            const inquirerPromptStub = jest.spyOn(inquirerModule, 'prompt').mockReturnValue({});
            const consoleErrorStub = jest.spyOn(console, 'error').mockImplementation(jest.fn());
            const consoleLogStub = jest.spyOn(console, 'log').mockImplementation(jest.fn());

            // Test with real entities, just some methods stubbed
            const instance = new StencilInit({
                inquirer: inquirerModule,
                stencilConfigManager,
                logger: console,
            });
            await instance.run(cliOptions);

            expect(inquirerPromptStub).toHaveBeenCalledTimes(0);
            expect(consoleErrorStub).toHaveBeenCalledTimes(0);
            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(saveStencilConfigStub).toHaveBeenCalledTimes(1);

            expect(saveStencilConfigStub).toHaveBeenCalledWith(expectedResult);
            expect(consoleLogStub).toHaveBeenCalledWith(
                'You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan,
            );
        });
    });
});

describe('StencilInit unit tests', () => {
    const serverConfigPort = 3000;
    const dotStencilFilePath = '/some/test/path/.stencil';
    const getLoggerStub = () => ({
        log: jest.fn(),
        error: jest.fn(),
    });
    const getInquirerStub = () => ({
        prompt: jest.fn().mockReturnValue(getAnswers()),
    });
    const getStencilConfigManagerStub = () => ({
        read: jest.fn().mockReturnValue(getStencilConfig()),
        save: jest.fn(),
    });
    const getServerConfigStub = () => ({
        get: jest.fn(
            (prop) =>
                ({
                    '/server/port': serverConfigPort,
                }[prop]),
        ),
    });

    const createStencilInitInstance = ({
        inquirer,
        stencilConfigManager,
        serverConfig,
        logger,
    } = {}) => {
        const passedArgs = {
            inquirer: inquirer || getInquirerStub(),
            stencilConfigManager: stencilConfigManager || getStencilConfigManagerStub(),
            serverConfig: serverConfig || getServerConfigStub(),
            logger: logger || getLoggerStub(),
        };
        const instance = new StencilInit(passedArgs);

        return {
            passedArgs,
            instance,
        };
    };

    describe('constructor', () => {
        it('should create an instance of StencilInit without options parameters passed', async () => {
            const instance = new StencilInit();

            expect(instance).toBeInstanceOf(StencilInit);
        });

        it('should create an instance of StencilInit with options parameters passed', async () => {
            const { instance } = createStencilInitInstance();

            expect(instance).toBeInstanceOf(StencilInit);
        });
    });

    describe('readStencilConfig', () => {
        it("should return an empty config if the file doesn't exist", async () => {
            const loggerStub = getLoggerStub();
            const stencilConfigManagerStub = getStencilConfigManagerStub();
            stencilConfigManagerStub.read.mockReturnValue(null);

            const { instance } = createStencilInitInstance({
                stencilConfigManager: stencilConfigManagerStub,
                logger: loggerStub,
            });
            const res = await instance.readStencilConfig(dotStencilFilePath);

            expect(stencilConfigManagerStub.read).toHaveBeenCalledTimes(1);
            expect(stencilConfigManagerStub.read).toHaveBeenCalledWith(true, true);
            expect(loggerStub.error).toHaveBeenCalledTimes(0);

            expect(res).toEqual({});
        });

        it('should read the file and return parsed results if the file exists and it is valid', async () => {
            const parsedConfig = getStencilConfig();
            const stencilConfigManagerStub = getStencilConfigManagerStub();
            const loggerStub = getLoggerStub();
            stencilConfigManagerStub.read.mockReturnValue(parsedConfig);

            const { instance } = createStencilInitInstance({
                stencilConfigManager: stencilConfigManagerStub,
                logger: loggerStub,
            });
            const res = await instance.readStencilConfig(dotStencilFilePath);

            expect(stencilConfigManagerStub.read).toHaveBeenCalledTimes(1);
            expect(stencilConfigManagerStub.read).toHaveBeenCalledWith(true, true);
            expect(loggerStub.error).toHaveBeenCalledTimes(0);

            expect(res).toEqual(parsedConfig);
        });

        it('should read the file, inform the user that the file is broken and return an empty config', async () => {
            const thrownError = new Error('invalid file');
            const loggerStub = getLoggerStub();
            const stencilConfigManagerStub = getStencilConfigManagerStub();
            stencilConfigManagerStub.read.mockRejectedValue(thrownError);

            const { instance } = createStencilInitInstance({
                stencilConfigManager: stencilConfigManagerStub,
                logger: loggerStub,
            });
            const res = await instance.readStencilConfig(dotStencilFilePath);

            expect(stencilConfigManagerStub.read).toHaveBeenCalledTimes(1);
            expect(stencilConfigManagerStub.read).toHaveBeenCalledWith(true, true);
            expect(loggerStub.error).toHaveBeenCalledTimes(1);

            expect(res).toEqual({});
        });
    });

    describe('getDefaultAnswers', () => {
        // eslint-disable-next-line jest/expect-expect
        it('should not mutate the passed objects', async () => {
            const stencilConfig = getStencilConfig();

            const { instance } = createStencilInitInstance();
            await assertNoMutations([stencilConfig], () =>
                instance.getDefaultAnswers(stencilConfig),
            );
        });

        it('should pick values from stencilConfig if not empty', async () => {
            const stencilConfig = getStencilConfig();

            const { instance } = createStencilInitInstance();
            const res = instance.getDefaultAnswers(stencilConfig);

            expect(res.normalStoreUrl).toEqual(stencilConfig.normalStoreUrl);
            expect(res.accessToken).toEqual(stencilConfig.accessToken);
            expect(res.port).toEqual(stencilConfig.port);
        });

        it('should pick values from serverConfig if stencilConfig are empty', async () => {
            const stencilConfig = _.pick(getStencilConfig(), ['accessToken', 'url']);

            const { instance } = createStencilInitInstance();
            const res = instance.getDefaultAnswers(stencilConfig);

            expect(res.port).toEqual(serverConfigPort);

            expect(res.normalStoreUrl).toEqual(stencilConfig.url);
            expect(res.accessToken).toEqual(stencilConfig.accessToken);
        });
    });

    describe('getQuestions', () => {
        it('should get all questions if no cli options were passed', async () => {
            const defaultAnswers = getAnswers();
            const cliConfig = {};

            const { instance } = createStencilInitInstance();
            const res = instance.getQuestions(defaultAnswers, cliConfig);

            // We compare the serialized results because the objects contain functions which hinders direct comparison
            expect(JSON.stringify(res)).toEqual(JSON.stringify(getQuestions()));
        });
    });

    describe('askQuestions', () => {
        it('should call inquirer.prompt with correct arguments', async () => {
            const questions = getQuestions();
            const inquirerStub = getInquirerStub();

            const { instance } = createStencilInitInstance({
                inquirer: inquirerStub,
            });
            await instance.askQuestions(questions);

            expect(inquirerStub.prompt).toHaveBeenCalledTimes(1);

            // We compare the serialized results because the objects contain functions which hinders direct comparison
            expect(JSON.stringify(inquirerStub.prompt.mock.calls)).toEqual(
                JSON.stringify([[questions]]),
            );
        });
    });

    describe('applyAnswers', () => {
        // eslint-disable-next-line jest/expect-expect
        it('should not mutate the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const answers = getAnswers();

            const { instance } = createStencilInitInstance();
            await assertNoMutations([stencilConfig, answers], () =>
                instance.applyAnswers(stencilConfig, answers),
            );
        });

        it('should correctly merge values from the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const answers = getAnswers();

            const { instance } = createStencilInitInstance();
            const res = instance.applyAnswers(stencilConfig, answers);

            expect(res.normalStoreUrl).toEqual(answers.normalStoreUrl);
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.port).toEqual(answers.port);

            expect(res.githubToken).toEqual(stencilConfig.githubToken);
            expect(res.customLayouts).toEqual(stencilConfig.customLayouts);
        });

        it("should add a customLayouts property with default empty values if it's absent in stencilConfig", async () => {
            const stencilConfig = _.omit(getStencilConfig(), 'customLayouts');
            const answers = getAnswers();

            const { instance } = createStencilInitInstance();
            const res = instance.applyAnswers(stencilConfig, answers);

            expect(res.customLayouts).toEqual(DEFAULT_CUSTOM_LAYOUTS_CONFIG);
            // Make sure that other props aren't overwritten:
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.githubToken).toEqual(stencilConfig.githubToken);
        });
    });

    describe('apiHostFromStoreUrl', () => {
        it('should return the integration api host for integration stores', async () => {
            const storeUrl = 'https://store-url.my-integration.zone';
            const expected = 'https://api.integration.zone';

            const { instance } = createStencilInitInstance();
            const res = instance.apiHostFromStoreUrl(storeUrl);

            expect(res).toEqual(expected);
        });

        it('should return the staging api host for staging stores', async () => {
            const storeUrl = 'https://store-url.my-staging.zone';
            const expected = 'https://api.staging.zone';

            const { instance } = createStencilInitInstance();
            const res = instance.apiHostFromStoreUrl(storeUrl);

            expect(res).toEqual(expected);
        });

        it('should return the API_HOST constant for all ohter stores', async () => {
            const storeUrl = 'https://store-url.mystore.com';

            const { instance } = createStencilInitInstance();
            const res = instance.apiHostFromStoreUrl(storeUrl);

            expect(res).toEqual(API_HOST);
        });
    });
});
