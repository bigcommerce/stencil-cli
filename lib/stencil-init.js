require('colors');

const inquirerModule = require('inquirer');

const serverConfigModule = require('../server/config');
const StencilConfigManager = require('./StencilConfigManager');
const { DEFAULT_CUSTOM_LAYOUTS_CONFIG, API_HOST } = require('../constants');

class StencilInit {
    /**
     * @param inquirer
     * @param stencilConfigManager
     * @param serverConfig
     * @param logger
     */
    constructor({
        inquirer = inquirerModule,
        stencilConfigManager = new StencilConfigManager(),
        serverConfig = serverConfigModule,
        logger = console,
    } = {}) {
        this._inquirer = inquirer;
        this._stencilConfigManager = stencilConfigManager;
        this._serverConfig = serverConfig;
        this._logger = logger;
    }

    /**
     * @param {object} cliOptions
     * @param {string} cliOptions.normalStoreUrl
     * @param {string} cliOptions.accessToken
     * @param {number} cliOptions.port
     * @param {string} [cliOptions.envFile]
     * @returns {Promise<void>}
     */
    async run(cliOptions = {}) {
        const oldStencilConfig = await this.readStencilConfig(cliOptions.envFile);
        const defaultAnswers = this.getDefaultAnswers(oldStencilConfig);
        const questions = this.getQuestions(defaultAnswers, cliOptions);
        const answers = await this.askQuestions(questions);
        const updatedStencilConfig = this.applyAnswers(oldStencilConfig, answers, cliOptions);
        await this._stencilConfigManager.save(updatedStencilConfig, updatedStencilConfig.envFile);

        this._logger.log(
            'You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan,
        );
    }

    /**
     * @returns {object}
     */
    async readStencilConfig(envFile) {
        let parsedConfig;

        try {
            parsedConfig = await this._stencilConfigManager.read(true, true, envFile);
        } catch (err) {
            this._logger.error(
                'Detected a broken stencil-cli config:\n',
                err,
                '\nThe file will be rewritten with your answers',
            );
        }

        return parsedConfig || {};
    }

    /**
     * @param {{port: (number), normalStoreUrl: (string), accessToken: (string), apiHost: (string)}} stencilConfig
     * @returns {{port: (number), normalStoreUrl: (string), accessToken: (string), apiHost: (string)}}
     */
    getDefaultAnswers(stencilConfig) {
        return {
            normalStoreUrl: stencilConfig.normalStoreUrl,
            accessToken: stencilConfig.accessToken,
            port: stencilConfig.port || this._serverConfig.get('/server/port'),
            apiHost: API_HOST,
        };
    }

    /**
     * @param {{port: (number), normalStoreUrl: (string), accessToken: (string)}} defaultAnswers
     * @param {{port: (number), normalStoreUrl: (string), accessToken: (string)}} cliOptions
     * @returns {{object[]}}
     */
    getQuestions(defaultAnswers, cliOptions) {
        const prompts = [];

        if (!cliOptions.normalStoreUrl) {
            prompts.push({
                type: 'input',
                name: 'normalStoreUrl',
                message: "What is the URL of your store's home page?",
                validate: (val) => /^https?:\/\//.test(val) || 'You must enter a URL',
                default: defaultAnswers.normalStoreUrl,
            });
        }

        if (!cliOptions.accessToken) {
            prompts.push({
                type: 'input',
                name: 'accessToken',
                message: 'What is your Stencil OAuth Access Token?',
                default: defaultAnswers.accessToken,
                filter: (val) => val.trim(),
            });
        }

        if (!cliOptions.port) {
            prompts.push({
                type: 'input',
                name: 'port',
                message: 'What port would you like to run the server on?',
                default: defaultAnswers.port,
                validate: (val) => {
                    if (Number.isNaN(val)) {
                        return 'You must enter an integer';
                    }
                    if (val < 1024 || val > 65535) {
                        return 'The port number must be between 1025 and 65535';
                    }
                    return true;
                },
            });
        }

        return prompts;
    }

    /**
     * @param {{object[]}} questions
     * @returns {Promise<object>}
     */
    async askQuestions(questions) {
        return questions.length ? this._inquirer.prompt(questions) : {};
    }

    updateApiHost(stencilConfig, cliOptions) {
        const host = cliOptions.apiHost || API_HOST;

        console.log('Set API host to: ' + host);

        return { ...stencilConfig, apiHost: host };
    }

    /**
     * @param {object} stencilConfig
     * @param {object} answers
     * @param {object} cliOptions
     * @returns {object}
     */
    applyAnswers(stencilConfig, answers, cliOptions) {
        const config = this.updateApiHost(stencilConfig, cliOptions);
        return {
            customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG,
            ...config,
            ...cliOptions,
            ...answers,
        };
    }
}

module.exports = StencilInit;
