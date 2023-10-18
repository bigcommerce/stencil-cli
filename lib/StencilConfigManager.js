require('colors');
const fsModule = require('fs');
const osModule = require('os');
const path = require('path');
const dotenv = require('dotenv');

const fsUtilsModule = require('./utils/fsUtils');
const { THEME_PATH, API_HOST } = require('../constants');

class StencilConfigManager {
    constructor({
        themePath = THEME_PATH,
        fs = fsModule,
        os = osModule,
        fsUtils = fsUtilsModule,
        logger = console,
    } = {}) {
        this.oldConfigFileName = '.stencil';
        this.configFileName = 'config.stencil.json';
        this.secretsFileName = 'secrets.stencil.json';

        this.themePath = themePath;
        this.oldConfigPath = path.join(themePath, this.oldConfigFileName);
        this.configPath = path.join(themePath, this.configFileName);
        this.secretsPath = path.join(themePath, this.secretsFileName);
        this.secretFieldsSet = new Set(['accessToken', 'githubToken']);

        this._fs = fs;
        this._os = os;
        this._fsUtils = fsUtils;
        this._logger = logger;
    }

    /**
     * @param {boolean} ignoreFileNotExists
     * @param {boolean} ignoreMissingFields
     * @returns {object|null}
     */
    async read(ignoreFileNotExists = false, ignoreMissingFields = false, envFile = null) {
        if (this._fs.existsSync(this.oldConfigPath)) {
            let parsedConfig;
            try {
                parsedConfig = await this._fsUtils.parseJsonFile(this.oldConfigPath);
                // Tolerate broken files. We should migrate the old config first
                //  and then validation will throw an error about missing fields
                // eslint-disable-next-line no-empty
            } catch {
                parsedConfig = {};
            }
            await this._migrateOldConfig(parsedConfig);
            return this._validateStencilConfig(parsedConfig, ignoreMissingFields);
        }

        const generalConfig = this._fs.existsSync(this.configPath)
            ? await this._fsUtils.parseJsonFile(this.configPath)
            : null;
        const secretsConfig = await this._getSecretsConfig(generalConfig);
        const envConfig = this._getConfigFromEnvVars(envFile);

        if (envConfig) {
            const parsedConfig = { ...generalConfig, ...envConfig };
            return this._validateStencilConfig(parsedConfig, ignoreMissingFields);
        }

        if (generalConfig || secretsConfig) {
            const parsedConfig = { ...generalConfig, ...secretsConfig };
            return this._validateStencilConfig(parsedConfig, ignoreMissingFields);
        }

        if (ignoreFileNotExists) {
            return null;
        }

        throw new Error('Please run'.red + ' $ stencil init'.cyan + ' first.'.red);
    }

    /**
     * @param {object} config
     */
    async save(config, envFile) {
        const { generalConfig, secretsConfig } = this._splitStencilConfig(config);

        if (envFile) {
            await this._fs.promises.writeFile(
                this.configPath,
                JSON.stringify({ customLayouts: generalConfig.customLayouts }, null, 2),
            );

            this._setEnvValuesToFile(
                {
                    STENCIL_ACCESS_TOKEN: secretsConfig.accessToken,
                    STENCIL_GITHUB_TOKEN: secretsConfig.githubToken,
                    STENCIL_STORE_URL: generalConfig.normalStoreUrl,
                    STENCIL_API_HOST: generalConfig.apiHost,
                    STENCIL_PORT: generalConfig.port,
                },
                envFile,
            );
        } else {
            await this._fs.promises.writeFile(
                this.configPath,
                JSON.stringify(generalConfig, null, 2),
            );
            await this._fs.promises.writeFile(
                this.secretsPath,
                JSON.stringify(secretsConfig, null, 2),
            );
        }
    }

    /**
     * @param {Array.<{key: String, value: any}>} keyValPairs
     * @param {string} envFile
     */
    _setEnvValuesToFile(keyValPairs, envFile) {
        const envFilePath = path.join(this.themePath, envFile);

        for (const [key, value] of Object.entries(keyValPairs)) {
            if (!this._fs.existsSync(envFile)) {
                this._fs.openSync(envFile, 'a');
            }

            const vars = this._fs.readFileSync(envFile, 'utf8').split(this._os.EOL);

            // Search for uncommented .env key-value line
            const envLineRegex = new RegExp(`(?<!#\\s*)${key}(?==)`);
            const target = vars.findIndex((line) => line.match(envLineRegex));

            if (target !== -1) {
                // Replace value if found
                vars.splice(target, 1, `${key}=${value || ''}`);
            } else if (vars.length === 1 && vars[0] === '') {
                // Add at beginning of array if only content is empty string
                vars.unshift(`${key}=${value || ''}`);
            } else {
                // For newline at the end if not found
                if (vars[vars.length - 1] !== '') {
                    vars.push('');
                }

                // If key doesn't exist, add as new line
                vars.splice(vars.length - 1, 0, `${key}=${value || ''}`);
            }

            this._fs.writeFileSync(envFilePath, vars.join(this._os.EOL));
        }
    }

    /**
     * @private
     * @param {object} config
     */
    _splitStencilConfig(config) {
        return Object.entries(config).reduce(
            (res, [key, value]) => {
                if (this.secretFieldsSet.has(key)) {
                    res.secretsConfig[key] = value;
                } else {
                    res.generalConfig[key] = value;
                }
                return res;
            },
            { secretsConfig: {}, generalConfig: {} },
        );
    }

    /**
     * @private
     * @param {object | null} config
     * @returns {Promise<object | null>}
     */
    async _getSecretsConfig(generalConfig) {
        if (generalConfig && generalConfig.secretsFileName) {
            const secretsPath = path.join(this.themePath, generalConfig.secretsFileName);

            if (this._fs.existsSync(secretsPath)) {
                return this._fsUtils.parseJsonFile(secretsPath);
            }
        }

        return this._fs.existsSync(this.secretsPath)
            ? this._fsUtils.parseJsonFile(this.secretsPath)
            : null;
    }

    /**
     * @private
     * @returns {object | null}
     */
    _getConfigFromEnvVars(envFile) {
        if (!envFile) return null;

        dotenv.config({ path: path.join(this.themePath, envFile) });

        const envConfig = {
            normalStoreUrl: process.env.STENCIL_STORE_URL,
            accessToken: process.env.STENCIL_ACCESS_TOKEN,
            githubToken: process.env.STENCIL_GITHUB_TOKEN,
            apiHost: process.env.STENCIL_API_HOST,
            port: process.env.STENCIL_PORT,
        };

        if (!envConfig.normalStoreUrl || !envConfig.accessToken || !envConfig.port) {
            return null;
        }

        for (const [key, val] of Object.entries(envConfig)) {
            if (!val) delete envConfig[key];
        }

        return envConfig;
    }

    /**
     * @private
     * @param {object} config
     * @param {boolean} ignoreMissingFields
     * @returns {object}
     */
    _validateStencilConfig(configFile, ignoreMissingFields) {
        const config = configFile;

        if (!ignoreMissingFields && (!config.normalStoreUrl || !config.customLayouts)) {
            throw new Error(
                'Error: Your stencil config is outdated. Please run'.red +
                    ' $ stencil init'.cyan +
                    ' again.'.red,
            );
        }

        if (!config.apiHost) {
            this._logger.log(
                `No api host found in config file, falling back to ${API_HOST}. You may need to run 'stencil init' again.`,
            );
            config.apiHost = API_HOST;
        }

        return config;
    }

    /**
     * @private
     * @param {object} config
     */
    async _migrateOldConfig(config) {
        this._logger.log(
            `Detected a deprecated ${this.oldConfigFileName.cyan} file.\n` +
                `It will be replaced with ${this.configFileName.cyan} and ${this.secretsFileName.cyan}\n`,
        );

        await this.save(config);
        await this._fs.promises.unlink(this.oldConfigPath);

        this._logger.log(
            `The deprecated ${this.oldConfigFileName.cyan} file was successfully replaced.\n` +
                `Make sure to add ${this.secretsFileName.cyan} to .gitignore.\n` +
                `${this.configFileName.cyan} can be tracked by git if you wish.\n`,
        );
    }
}

module.exports = StencilConfigManager;
