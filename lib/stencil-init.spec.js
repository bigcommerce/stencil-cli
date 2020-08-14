'use strict';

const _ = require('lodash');
const Code = require('code');
const Sinon = require('sinon');
const Lab = require('@hapi/lab');
const fs = require('fs');
const inquirer = require('inquirer');

const jsonLint = require('./json-lint');
const serverConfig = require('../server/config');
const StencilInit = require('./stencil-init');
const { DEFAULT_CUSTOM_LAYOUTS_CONFIG } = require('../constants');
const { assertNoMutations } = require('../test/assertions/assertNoMutations');

const { afterEach, beforeEach, describe, it } = exports.lab = Lab.script();
const { expect }  = Code;

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

afterEach(() => Sinon.restore());

describe('StencilInit integration tests:', () => {
    describe('run', async () => {
        it('should perform all the actions, save the result and inform the user about the successful finish', async () => {
            const dotStencilFilePath = './test/_mocks/bin/dotStencilFile.json';
            const answers = getAnswers();
            const expectedResult = JSON.stringify({ customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG, ...answers }, null, 2);
            const fsWriteFileSyncStub = Sinon.stub(fs, "writeFileSync");
            const inquirerPromptStub = Sinon.stub(inquirer, 'prompt').returns(answers);
            const consoleErrorStub = Sinon.stub(console, 'error');
            const consoleLogStub = Sinon.stub(console, 'log');

            // Test with real entities, just some methods stubbed
            const instance = new StencilInit({
                inquirer,
                jsonLint,
                fs,
                serverConfig,
                logger: console,
            });
            await instance.run(dotStencilFilePath, getCliOptions());

            expect(fsWriteFileSyncStub.calledOnce).to.be.true();
            expect(inquirerPromptStub.calledOnce).to.be.true();
            expect(consoleErrorStub.calledOnce).to.be.false();
            expect(consoleLogStub.calledOnce).to.be.true();

            expect(fsWriteFileSyncStub.lastCall.args).to.equal([dotStencilFilePath, expectedResult]);
            expect(consoleLogStub.calledWith('You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan)).to.be.true();
        });
    });
});

describe('StencilInit unit tests:', () => {
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
            log: Sinon.stub(),
            error: Sinon.stub(),
        };
        inquirerStub = {
            prompt: Sinon.stub().returns(getAnswers()),
        };
        jsonLintStub = {
            parse: Sinon.stub().returns(getStencilConfig()),
        };
        fsStub = {
            existsSync: Sinon.stub(),
            readFileSync: Sinon.stub(),
            writeFileSync: Sinon.stub(),
        };
        serverConfigStub = {
            get: Sinon.stub().callsFake(prop => {
                return ({
                    '/server/port': serverConfigPort,
                })[prop];
            }),
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

            expect(instance).to.be.instanceOf(StencilInit);
        });

        it('should create an instance of StencilInit with options parameters passed', async () => {
            const instance = getStencilInitInstance();

            expect(instance).to.be.instanceOf(StencilInit);
        });
    });

    describe('readStencilConfig ', async () => {
        it('should return an empty config if the file doesn\'t exist', async () => {
            const instance = getStencilInitInstance();
            fsStub.existsSync.returns(false);

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync.calledOnce).to.be.true();
            expect(res).to.equal({});
        });

        it('should read the file and return parsed results if the file exists and it is valid', async () => {
            const parsedConfig = getStencilConfig();
            const serializedConfig = JSON.stringify(parsedConfig, null, 2);
            const instance = getStencilInitInstance();
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.returns(serializedConfig);
            jsonLintStub.parse.returns(parsedConfig);

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync.calledOnce).to.be.true();
            expect(fsStub.readFileSync.calledOnce).to.be.true();
            expect(jsonLintStub.parse.calledOnce).to.be.true();
            expect(consoleStub.error.calledOnce).to.be.false();

            expect(fsStub.existsSync.calledWith(dotStencilFilePath)).to.be.true();
            expect(fsStub.readFileSync.calledWith(dotStencilFilePath, { encoding: 'utf-8' })).to.be.true();
            expect(jsonLintStub.parse.calledWith(serializedConfig, dotStencilFilePath)).to.be.true();

            expect(res).to.equal(parsedConfig);
        });

        it('should read the file, inform the user that the file is broken and return an empty config', async () => {
            const serializedConfig = '{ I am broken! }';
            const thrownError = new Error('invalid file');
            const instance = getStencilInitInstance();
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.returns(serializedConfig);
            jsonLintStub.parse.throws(thrownError);

            const res = instance.readStencilConfig(dotStencilFilePath);

            expect(fsStub.existsSync.calledOnce).to.be.true();
            expect(fsStub.readFileSync.calledOnce).to.be.true();
            expect(jsonLintStub.parse.calledOnce).to.be.true();
            expect(consoleStub.error.calledOnce).to.be.true();

            expect(fsStub.existsSync.calledWith(dotStencilFilePath)).to.be.true();
            expect(fsStub.readFileSync.calledWith(dotStencilFilePath, { encoding: 'utf-8' })).to.be.true();
            expect(jsonLintStub.parse.calledWith(serializedConfig, dotStencilFilePath)).to.be.true();

            expect(res).to.equal({});
        });
    });

    describe('getDefaultAnswers', async () => {
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

            expect(res.normalStoreUrl).to.equal(cliOptions.url);
            expect(res.accessToken).to.equal(cliOptions.token);
            expect(res.port).to.equal(cliOptions.port);
        });

        it('should pick values from stencilConfig if cliOptions are empty', async () => {
            const stencilConfig = getStencilConfig();
            const cliOptions = {};
            const instance = getStencilInitInstance();

            const res = instance.getDefaultAnswers(stencilConfig, cliOptions);

            expect(res.normalStoreUrl).to.equal(stencilConfig.normalStoreUrl);
            expect(res.accessToken).to.equal(stencilConfig.accessToken);
            expect(res.port).to.equal(stencilConfig.port);
        });

        it('should pick values from serverConfig if stencilConfig and cliOptions are empty', async () => {
            const cliOptions = _.pick(getCliOptions(), ['url']);
            const stencilConfig = _.pick(getStencilConfig(), ['accessToken']);
            const instance = getStencilInitInstance();

            const res = instance.getDefaultAnswers(stencilConfig, cliOptions);

            expect(res.port).to.equal(serverConfigPort);

            expect(res.normalStoreUrl).to.equal(cliOptions.url);
            expect(res.accessToken).to.equal(stencilConfig.accessToken);
        });
    });

    describe('askQuestions', async () => {
        it('should call inquirer.prompt with correct arguments', async () => {
            const defaultAnswers = getAnswers();
            const instance = getStencilInitInstance();

            await instance.askQuestions(defaultAnswers);

            expect(inquirerStub.prompt.calledOnce).to.be.true();
            // We compare the serialized results because the objects contain functions which hinders direct comparison
            expect(JSON.stringify(inquirerStub.prompt.lastCall.args)).to.equal(JSON.stringify([[
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
            ]]));
        });
    });

    describe('applyAnswers', async () => {
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

            expect(res.normalStoreUrl).to.equal(answers.normalStoreUrl);
            expect(res.accessToken).to.equal(answers.accessToken);
            expect(res.port).to.equal(answers.port);

            expect(res.githubToken).to.equal(stencilConfig.githubToken);
            expect(res.customLayouts).to.equal(stencilConfig.customLayouts);
        });

        it('should add a customLayouts property with default empty values if it\'s absent in stencilConfig', async () => {
            const stencilConfig = _.omit(getStencilConfig(), 'customLayouts');
            const answers = getAnswers();
            const instance = getStencilInitInstance();

            const res = instance.applyAnswers(stencilConfig, answers);

            expect(res.customLayouts).to.equal(DEFAULT_CUSTOM_LAYOUTS_CONFIG);
            // Make sure that other props aren't overwritten:
            expect(res.accessToken).to.equal(answers.accessToken);
            expect(res.githubToken).to.equal(stencilConfig.githubToken);
        });
    });

    describe('saveStencilConfig ', async () => {
        it('should call fs.writeFileSync with the serialized config', async () => {
            const stencilConfig = getStencilConfig();
            const serializedConfig = JSON.stringify(stencilConfig, null, 2);
            const instance = getStencilInitInstance();

            instance.saveStencilConfig(stencilConfig, dotStencilFilePath);

            expect(fsStub.writeFileSync.calledOnce).to.be.true();
            expect(fsStub.writeFileSync.calledWith(dotStencilFilePath, serializedConfig)).to.be.true();
        });
    });
});
