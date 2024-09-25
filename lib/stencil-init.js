import 'colors';
import inquirerModule from 'inquirer';
import * as nypmModule from 'nypm';
import spinnerModule from './spinner.js';
import * as serverConfigModule from '../server/config.js';
import StencilConfigManager from './StencilConfigManager.js';
import { DEFAULT_CUSTOM_LAYOUTS_CONFIG, API_HOST, THEME_PATH } from '../constants.js';

class StencilInit {
    /**
     * @param inquirer
     * @param stencilConfigManager
     * @param serverConfig
     * @param logger
     * @param nypm
     * @param spinner
     */
    constructor({
        inquirer = inquirerModule,
        stencilConfigManager = new StencilConfigManager(),
        serverConfig = serverConfigModule,
        logger = console,
        nypm = nypmModule,
        spinner = spinnerModule,
    } = {}) {
        this._inquirer = inquirer;
        this._stencilConfigManager = stencilConfigManager;
        this._serverConfig = serverConfig;
        this._logger = logger;
        this._nypm = nypm;
        this._spinner = spinner;
    }

    /**
     * @param {object} cliOptions
     * @param {string} cliOptions.normalStoreUrl
     * @param {string} cliOptions.accessToken
     * @param {number} cliOptions.port
     * @returns {Promise<void>}
     */
    async run(cliOptions = {}) {
        const oldStencilConfig = await this.readStencilConfig();
        const defaultAnswers = this.getDefaultAnswers(oldStencilConfig);
        const questions = this.getQuestions(defaultAnswers, cliOptions);
        const answers = await this.askQuestions(questions);
        const updatedStencilConfig = this.applyAnswers(oldStencilConfig, answers, cliOptions);
        await this._stencilConfigManager.save(updatedStencilConfig);
        await this.installDependencies(THEME_PATH, answers.packageManager, cliOptions);
        this._logger.log(
            'You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan,
        );
    }

    /**
     * @returns {object}
     */
    async readStencilConfig() {
        let parsedConfig;
        try {
            parsedConfig = await this._stencilConfigManager.read(true, true);
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
        if (!cliOptions.packageManager) {
            prompts.push({
                type: 'list',
                name: 'packageManager',
                message: 'What is your favourite Package Manager?',
                choices: ['npm', 'yarn', 'pnpm'],
                default: this.getPackageManager(),
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

    getPackageManager() {
        const userAgent = process.env.npm_config_user_agent || '';
        if (userAgent.startsWith('yarn')) {
            return 'yarn';
        }
        if (userAgent.startsWith('pnpm')) {
            return 'pnpm';
        }
        return 'npm';
    }

    /**
     *
     * @param {string} projectDir
     * @param {object} packageManager
     * @param {object} cliOptions
     * @returns
     */
    installDependencies(projectDir, packageManager, cliOptions) {
        if (cliOptions.skipInstall) {
            return Promise.resolve();
        }
        return this._spinner(
            this._nypm.installDependencies({
                cwd: projectDir,
                silent: true,
                packageManager,
            }),
            {
                text: `Installing dependencies. This could take a minute...`,
                successText: `Dependencies installed successfully`,
                failText: (err) => `Failed to install dependencies: ${err.message}`.red,
            },
        );
    }
}
export default StencilInit;
