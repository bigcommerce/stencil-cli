'use strict';

const _ = require('lodash');
const fs = require('fs');
const inquirer = require('inquirer');

const jsonLint = require('./json-lint');
const serverConfig = require('../server/config');
const StencilInit = require('./stencil-init');
const { DEFAULT_CUSTOM_LAYOUTS_CONFIG } = require('../constants');
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
    normalStoreUrl: "https://url-from-stencilConfig.mybigcommerce.com",
    port: 3001,
    accessToken: "accessToken_from_stencilConfig",
    githubToken: "githubToken_1234567890",
});
const getAnswers = () => ({
    normalStoreUrl: "https://url-from-answers.mybigcommerce.com",
    port: 3003,
    accessToken: "accessToken_from_answers",
});
const getCliOptions = () => ({
    url: "https://url-from-cli-options.mybigcommerce.com",
    port: 3002,
    token: "accessToken_from_CLI_options",
});

afterEach(() => jest.restoreAllMocks());

describe('StencilInit integration tests', () => {
    describe('run',  () => {
        it('should perform all the actions, save the result and inform the user about the successful finish', async () => {
            const dotStencilFilePath = './test/_mocks/bin/dotStencilFile.json';
            const answers = getAnswers();
            const expectedResult = JSON.stringify({ customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG, ...answers }, null, 2);
            const fsWriteFileSyncStub = jest.spyOn(fs, "writeFileSync").mockImplementation(jest.fn());
            const inquirerPromptStub = jest.spyOn(inquirer, 'prompt').mockReturnValue(answers);
            const consoleErrorStub = jest.spyOn(console, 'error').mockImplementation(jest.fn());
            const consoleLogStub = jest.spyOn(console, 'log').mockImplementation(jest.fn());

            // Test with real entities, just some methods stubbed
            const instance = new StencilInit({
                inquirer,
                jsonLint,
                fs,
                serverConfig,
                logger: console,
            });
            await instance.run(dotStencilFilePath, getCliOptions());

            expect(fsWriteFileSyncStub).toHaveBeenCalledTimes(1);
            expect(inquirerPromptStub).toHaveBeenCalledTimes(1);
            expect(consoleErrorStub).toHaveBeenCalledTimes(0);
            expect(consoleLogStub).toHaveBeenCalledTimes(1);

            expect(fsWriteFileSyncStub).toHaveBeenCalledWith(dotStencilFilePath, expectedResult);
            expect(consoleLogStub).toHaveBeenCalledWith('You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan);
        });
    });
});

describe('StencilInit unit tests', () => {
    const serverConfigPort = 3000;
    const dotStencilFilePath = '/some/test/path/dotStencilFile.json';
    let consoleStub;
    let inquirerStub;
    let jsonLintStub;
    let fsStub;
    let serverConfigStub;
    let getStencilInitInstance;

    beforeEach(() => {
        consoleStub = {
            log: jest.fn(),
            error: jest.fn(),
        };
        inquirerStub = {
            prompt: jest.fn().mockReturnValue(getAnswers()),
        };
        jsonLintStub = {
            parse: jest.fn().mockReturnValue(getStencilConfig()),
        };
        fsStub = {
            existsSync: jest.fn(),
            readFileSync: jest.fn(),
            writeFileSync: jest.fn(),
        };
        serverConfigStub = {
            get: jest.fn(prop => ({
                '/server/port': serverConfigPort,
            })[prop]),
        };

        getStencilInitInstance = () => new StencilInit({
            inquirer: inquirerStub,
            jsonLint: jsonLintStub,
            fs: fsStub,
            serverConfig: serverConfigStub,
            logger: consoleStub,
        });
    });

    describe('constructor', () => {
        it('should create an instance of StencilInit without options parameters passed', async () => {
            const instance = new StencilInit();

            expect(instance).toBeInstanceOf(StencilInit);
        });

        it('should create an instance of StencilInit with options parameters passed', async () => {
            const instance = getStencilInitInstance();

            expect(instance).toBeInstanceOf(StencilInit);
        });
    });

    describe('readStencilConfig ', () => {
        it('should return an empty config if the file doesn\'t exist', async () => {
            const instance = getStencilInitInstance();
            fsStub.existsSync.mockReturnValue(false);

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
            expect(res).toEqual({});
        });

        it('should read the file and return parsed results if the file exists and it is valid', async () => {
            const parsedConfig = getStencilConfig();
            const serializedConfig = JSON.stringify(parsedConfig, null, 2);
            const instance = getStencilInitInstance();
            fsStub.existsSync.mockReturnValue(true);
            fsStub.readFileSync.mockReturnValue(serializedConfig);
            jsonLintStub.parse.mockReturnValue(parsedConfig);

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
            expect(fsStub.readFileSync).toHaveBeenCalledTimes(1);
            expect(jsonLintStub.parse).toHaveBeenCalledTimes(1);
            expect(consoleStub.error).toHaveBeenCalledTimes(0);

            expect(fsStub.existsSync).toHaveBeenCalledWith(dotStencilFilePath);
            expect(fsStub.readFileSync).toHaveBeenCalledWith(dotStencilFilePath, { encoding: 'utf-8' });
            expect(jsonLintStub.parse).toHaveBeenCalledWith(serializedConfig, dotStencilFilePath);

            expect(res).toEqual(parsedConfig);
        });

        it('should read the file, inform the user that the file is broken and return an empty config', async () => {
            const serializedConfig = '{ I am broken! }';
            const thrownError = new Error('invalid file');
            const instance = getStencilInitInstance();
            fsStub.existsSync.mockReturnValue(true);
            fsStub.readFileSync.mockReturnValue(serializedConfig);
            jsonLintStub.parse.mockImplementation(() => { throw thrownError; });

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync).toHaveBeenCalledTimes(1);
            expect(fsStub.readFileSync).toHaveBeenCalledTimes(1);
            expect(jsonLintStub.parse).toHaveBeenCalledTimes(1);
            expect(consoleStub.error).toHaveBeenCalledTimes(1);

            expect(fsStub.existsSync).toHaveBeenCalledWith(dotStencilFilePath);
            expect(fsStub.readFileSync).toHaveBeenCalledWith(dotStencilFilePath, { encoding: 'utf-8' });
            expect(jsonLintStub.parse).toHaveBeenCalledWith(serializedConfig, dotStencilFilePath);

            expect(res).toEqual({});
        });
    });

    describe('getDefaultAnswers', () => {
        // eslint-disable-next-line jest/expect-expect
        it('should not mutate the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const cliOptions = getCliOptions();
            const instance = getStencilInitInstance();

            await assertNoMutations(
                [stencilConfig, cliOptions],
                () => instance.getDefaultAnswers(stencilConfig, cliOptions),
            );
        });

        it('should pick values from cliOptions first if present', async () => {
            const stencilConfig = getStencilConfig();
            const cliOptions = getCliOptions();
            const instance = getStencilInitInstance();

            const res = instance.getDefaultAnswers(stencilConfig, cliOptions);

            expect(res.normalStoreUrl).toEqual(cliOptions.url);
            expect(res.accessToken).toEqual(cliOptions.token);
            expect(res.port).toEqual(cliOptions.port);
        });

        it('should pick values from stencilConfig if cliOptions are empty', async () => {
            const stencilConfig = getStencilConfig();
            const cliOptions = {};
            const instance = getStencilInitInstance();

            const res = instance.getDefaultAnswers(stencilConfig, cliOptions);

            expect(res.normalStoreUrl).toEqual(stencilConfig.normalStoreUrl);
            expect(res.accessToken).toEqual(stencilConfig.accessToken);
            expect(res.port).toEqual(stencilConfig.port);
        });

        it('should pick values from serverConfig if stencilConfig and cliOptions are empty', async () => {
            const cliOptions = _.pick(getCliOptions(), ['url']);
            const stencilConfig = _.pick(getStencilConfig(), ['accessToken']);
            const instance = getStencilInitInstance();

            const res = instance.getDefaultAnswers(stencilConfig, cliOptions);

            expect(res.port).toEqual(serverConfigPort);

            expect(res.normalStoreUrl).toEqual(cliOptions.url);
            expect(res.accessToken).toEqual(stencilConfig.accessToken);
        });
    });

    describe('askQuestions', () => {
        it('should call inquirer.prompt with correct arguments', async () => {
            const defaultAnswers = getAnswers();
            const instance = getStencilInitInstance();

            await instance.askQuestions(defaultAnswers);

            expect(inquirerStub.prompt).toHaveBeenCalledTimes(1);
            // We compare the serialized results because the objects contain functions which hinders direct comparison
            expect(JSON.stringify(inquirerStub.prompt.mock.calls)).toEqual(JSON.stringify([[[
                {
                    type: 'input',
                    name: 'normalStoreUrl',
                    message: 'What is the URL of your store\'s home page?',
                    validate(val) {
                        return /^https?:\/\//.test(val)
                            ? true
                            : 'You must enter a URL';
                    },
                    default: defaultAnswers.normalStoreUrl,
                },
                {
                    type: 'input',
                    name: 'accessToken',
                    message: 'What is your Stencil OAuth Access Token?',
                    default: defaultAnswers.accessToken,
                    filter: val => val.trim(),
                },
                {
                    type: 'input',
                    name: 'port',
                    message: 'What port would you like to run the server on?',
                    default: defaultAnswers.port,
                    validate: val => {
                        if (isNaN(val)) {
                            return 'You must enter an integer';
                        } else if (val < 1024 || val > 65535) {
                            return 'The port number must be between 1025 and 65535';
                        } else {
                            return true;
                        }
                    },
                },
            ]]]));
        });
    });

    describe('applyAnswers', () => {
        // eslint-disable-next-line jest/expect-expect
        it('should not mutate the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const answers = getAnswers();
            const instance = getStencilInitInstance();

            await assertNoMutations(
                [stencilConfig, answers],
                () => instance.applyAnswers(stencilConfig, answers),
            );
        });

        it('should correctly merge values from the passed objects', async () => {
            const stencilConfig = getStencilConfig();
            const answers = getAnswers();
            const instance = getStencilInitInstance();

            const res = instance.applyAnswers(stencilConfig, answers);

            expect(res.normalStoreUrl).toEqual(answers.normalStoreUrl);
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.port).toEqual(answers.port);

            expect(res.githubToken).toEqual(stencilConfig.githubToken);
            expect(res.customLayouts).toEqual(stencilConfig.customLayouts);
        });

        it('should add a customLayouts property with default empty values if it\'s absent in stencilConfig', async () => {
            const stencilConfig = _.omit(getStencilConfig(), 'customLayouts');
            const answers = getAnswers();
            const instance = getStencilInitInstance();

            const res = instance.applyAnswers(stencilConfig, answers);

            expect(res.customLayouts).toEqual(DEFAULT_CUSTOM_LAYOUTS_CONFIG);
            // Make sure that other props aren't overwritten:
            expect(res.accessToken).toEqual(answers.accessToken);
            expect(res.githubToken).toEqual(stencilConfig.githubToken);
        });
    });

    describe('saveStencilConfig ', () => {
        it('should call fs.writeFileSync with the serialized config', async () => {
            const stencilConfig = getStencilConfig();
            const serializedConfig = JSON.stringify(stencilConfig, null, 2);
            const instance = getStencilInitInstance();

            instance.saveStencilConfig(stencilConfig, dotStencilFilePath);

            expect(fsStub.writeFileSync).toHaveBeenCalledTimes(1);
            expect(fsStub.writeFileSync).toHaveBeenCalledWith(dotStencilFilePath, serializedConfig);
        });
    });
});
