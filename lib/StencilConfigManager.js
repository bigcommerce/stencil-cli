require('colors');
const fsModule = require('fs');
const path = require('path');

const fsUtilsModule = require('./utils/fsUtils');
const { THEME_PATH } = require('../constants');

class StencilConfigManager {
    constructor({ themePath = THEME_PATH, fs = fsModule, fsUtils = fsUtilsModule } = {}) {
        this.configFileName = '.stencil';

        this.themePath = themePath;
        this.configPath = path.join(themePath, this.configFileName);

        this._fs = fs;
        this._fsUtils = fsUtils;
    }

    /**
     * @returns {object|null}
     * @param {boolean} ignoreFileNotExists
     */
    async readStencilConfig(ignoreFileNotExists = false) {
        if (this._fs.existsSync(this.configPath)) {
            return this._fsUtils.parseJsonFile(this.configPath);
        }

        if (ignoreFileNotExists) {
            return null;
        }

        throw new Error('Please run'.red + ' $ stencil init'.cyan + ' first.'.red);
    }

    /**
     * @param {object} config
     */
    saveStencilConfig(config) {
        this._fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    }
}

module.exports = StencilConfigManager;
