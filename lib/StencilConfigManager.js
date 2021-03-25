require('colors');
const fsModule = require('fs');
const path = require('path');

const fsUtilsModule = require('./utils/fsUtils');
const { THEME_PATH } = require('../constants');

class StencilConfigManager {
    constructor({
        themePath = THEME_PATH,
        fs = fsModule,
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
        this._fsUtils = fsUtils;
        this._logger = logger;
    }

    /**
     * @param {boolean} ignoreFileNotExists
     * @param {boolean} ignoreMissingFields
     * @returns {object|null}
     */
    async read(ignoreFileNotExists = false, ignoreMissingFields = false) {
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
        const secretsConfig = this._fs.existsSync(this.secretsPath)
            ? await this._fsUtils.parseJsonFile(this.secretsPath)
            : null;
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
    async save(config) {
        const { generalConfig, secretsConfig } = this._splitStencilConfig(config);

        await this._fs.promises.writeFile(this.configPath, JSON.stringify(generalConfig, null, 2));
        await this._fs.promises.writeFile(this.secretsPath, JSON.stringify(secretsConfig, null, 2));
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
     * @param {object} config
     * @param {boolean} ignoreMissingFields
     * @returns {object}
     */
    _validateStencilConfig(config, ignoreMissingFields) {
        if (!ignoreMissingFields && (!config.normalStoreUrl || !config.customLayouts)) {
            throw new Error(
                'Error: Your stencil config is outdated. Please run'.red +
                    ' $ stencil init'.cyan +
                    ' again.'.red,
            );
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
