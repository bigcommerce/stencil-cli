const fsModule = require('fs');
const path = require('path');
const osModule = require('os');

const { PACKAGE_INFO, THEME_PATH } = require('../constants');
const ThemeConfig = require('./theme-config');
const StencilConfigManager = require('./StencilConfigManager');

class StencilDebug {
    constructor({
        fs = fsModule,
        os = osModule,
        logger = console,
        themeConfig = ThemeConfig.getInstance(THEME_PATH),
        stencilConfigManager = new StencilConfigManager(),
    } = {}) {
        this._fs = fs;
        this._os = os;
        this._logger = logger;
        this._themeConfig = themeConfig;
        this._stencilConfigManager = stencilConfigManager;
    }

    async run(options) {
        const platform = this.getPlatformInfo();
        const nodeVersion = this.getNodeJsVersion();
        const version = this.getCliVersion();
        const theme = await this.getThemeInfo();
        const stencil = await this.getStencilInfo();
        const info = {
            platform,
            version,
            nodeVersion,
            stencil,
            theme,
        };
        const result = this.prepareResult(info);
        await this.printResult(result, options);
    }

    getPlatformInfo() {
        return {
            type: this._os.type(),
            version: this._os.version(),
        };
    }

    getNodeJsVersion() {
        return process.version;
    }

    getCliVersion() {
        return PACKAGE_INFO.version;
    }

    async getThemeInfo() {
        this.checkExecutableLocation(this._themeConfig);

        const rawConfig = await this._themeConfig.getRawConfig();
        const {
            name,
            version,
            /* eslint-disable camelcase */
            template_engine,
            css_compiler,
            meta: { author_name },
            /* eslint-enable camelcase */
        } = rawConfig;
        return {
            name,
            version,
            template_engine,
            css_compiler,
            author_name,
        };
    }

    async getStencilInfo() {
        const { apiHost, normalStoreUrl, port } = await this._stencilConfigManager.read();
        return {
            apiHost,
            normalStoreUrl,
            port,
        };
    }

    checkExecutableLocation(themeConfig) {
        if (!themeConfig.configExists()) {
            throw new Error(
                `${
                    'You must have a '.red + 'config.json'.cyan
                } file in your top level theme directory.`,
            );
        }
    }

    prepareResult(data) {
        return JSON.stringify(data);
    }

    async printResult(result, options) {
        if (options.output) {
            const filePath = options.output.startsWith('/')
                ? options.output
                : path.join(process.cwd(), options.output);
            await this._fs.promises.writeFile(filePath, result);
        } else {
            this._logger.log(result);
        }
    }
}

module.exports = StencilDebug;
