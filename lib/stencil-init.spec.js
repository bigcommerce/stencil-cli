import { jest } from '@jest/globals';
import * as _ from 'lodash-es';
import inquirerModule from 'inquirer';
import StencilInit from './stencil-init.js';
import StencilConfigManager from './StencilConfigManager.js';
import { DEFAULT_CUSTOM_LAYOUTS_CONFIG, API_HOST } from '../constants.js';
import { assertNoMutations } from '../test/assertions/assertNoMutations.js';

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
    apiHost: API_HOST,
    packageManager: 'npm',
});
const getCliOptions = () => ({
    normalStoreUrl: 'https://url-from-cli-options.mybigcommerce.com',
    port: 3002,
    accessToken: 'accessToken_from_CLI_options',
    apiHost: API_HOST,
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
    {
        type: 'list',
        name: 'packageManager',
        message: 'What is your favourite Package Manager?',
        choices: ['npm', 'yarn', 'pnpm'],
        default: 'npm',
    },
];
const getNypmStub = () => ({
    installDependencies: jest.fn().mockResolvedValue(true),
});
const getSpinnnerStub = () => jest.fn().mockResolvedValue(true);
afterEach(() => jest.restoreAllMocks());
describe('StencilInit integration tests', () => {
    describe('run', () => {
        it('using cli prompts, should perform all the actions, save the result and inform the user about the successful finish', async () => {
            const answers = getAnswers();
            const expectedResult = {
                customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG,
                ...answers,
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
                nypm: getNypmStub(),
                spinner: getSpinnnerStub(),
            });
            await instance.run();
            expect(inquirerPromptStub).toHaveBeenCalledTimes(1);
            expect(consoleErrorStub).toHaveBeenCalledTimes(0);
            expect(consoleLogStub).toHaveBeenCalledTimes(2);
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
                nypm: getNypmStub(),
                spinner: getSpinnnerStub(),
            });
            await instance.run(cliOptions);
            expect(inquirerPromptStub).toHaveBeenCalledTimes(1);
            expect(consoleErrorStub).toHaveBeenCalledTimes(0);
            expect(consoleLogStub).toHaveBeenCalledTimes(2);
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
            nypm: getNypmStub(),
            spinner: getSpinnnerStub(),
        };
        const instance = new StencilInit(passedArgs);
        return {
            passedArgs,
            instance,
        };
    };
    describe('constructor', () => {
        it('should create an instance of StencilInit without options parameters passed', async () => {
            const instance = new StencilInit({
                nypm: getNypmStub(),
                spinner: getSpinnnerStub(),
            });
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
        const cliOptions = getCliOptions();
        // eslint-disable-next-line jest/expect-expect
        it('should not mutate the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const answers = getAnswers();
            const { instance } = createStencilInitInstance();
            await assertNoMutations([stencilConfig, answers, cliOptions], () =>
                instance.applyAnswers(stencilConfig, answers, cliOptions),
            );
        });
        it('should correctly merge values from the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            delete cliOptions.apiHost;
            const answers = getAnswers();
            const { instance } = createStencilInitInstance();
            const res = instance.applyAnswers(stencilConfig, answers, cliOptions);
            expect(res.normalStoreUrl).toEqual(answers.normalStoreUrl);
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.port).toEqual(answers.port);
            expect(res.apiHost).toEqual(answers.apiHost);
            expect(res.githubToken).toEqual(stencilConfig.githubToken);
            expect(res.customLayouts).toEqual(stencilConfig.customLayouts);
        });
        it("should add a customLayouts property with default empty values if it's absent in stencilConfig", async () => {
            const stencilConfig = _.omit(getStencilConfig(), 'customLayouts');
            const answers = getAnswers();
            const { instance } = createStencilInitInstance();
            const res = instance.applyAnswers(stencilConfig, answers, cliOptions);
            expect(res.customLayouts).toEqual(DEFAULT_CUSTOM_LAYOUTS_CONFIG);
            // Make sure that other props aren't overwritten:
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.githubToken).toEqual(stencilConfig.githubToken);
        });
    });
    describe('updateApiHost', () => {
        const options = getCliOptions();
        const config = getStencilConfig();
        it('should return the same config if it contains apiHost', async () => {
            const { instance } = createStencilInitInstance();
            delete options.apiHost;
            const res = instance.updateApiHost(config, options);
            expect(res).toEqual(config);
        });
        it('should add default apiHost if neither config, nor options contain apiHost', async () => {
            const { instance } = createStencilInitInstance();
            delete config.apiHost;
            delete options.apiHost;
            const res = instance.updateApiHost(config, options);
            const expected = getStencilConfig();
            expect(res).toEqual(expected);
        });
        it('should add custom apiHost', async () => {
            const { instance } = createStencilInitInstance();
            delete config.apiHost;
            delete options.apiHost;
            const cliOptions = { ...options, apiHost: 'https://custom.api.com' };
            const expectedConfig = { ...config, apiHost: 'https://custom.api.com' };
            const res = instance.updateApiHost(config, cliOptions);
            expect(res).toEqual(expectedConfig);
        });
    });
});
