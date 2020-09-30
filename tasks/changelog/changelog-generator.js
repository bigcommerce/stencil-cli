const path = require('path');

class ChangelogGenerator {
    /**
     * @param {Object} fs
     * @param {string} cwd
     * @param {Object} commandExecutor
     * @constructor
     */
    constructor(fs, cwd, commandExecutor) {
        this.fs = fs;
        this.cwd = cwd;
        this.commandExecutor = commandExecutor;
    }

    /**
     * @param {ChangelogOptions} customOptions
     * @param {function(error: Error?): void} done
     * @returns {void}
     */
    generateChangelog(customOptions, done) {
        const options = this._getOptions(customOptions);
        this.commandExecutor.executeCommand('touch', ['package.json'], {}, () => {
            this.commandExecutor.executeCommand('conventional-changelog', [], options, done);
        });
    }

    /**
     * @private
     * @param {ChangelogOptions} [customOptions={}]
     * @returns {ChangelogOptions}
     */
    _getOptions(customOptions = {}) {
        const options = {
            config: customOptions.preset ? undefined : path.join(__dirname, 'default-config.js'),
            infile: path.join(this.cwd, 'CHANGELOG.md'),
            sameFile: true,
            ...customOptions,
        };

        if (!this.fs.existsSync(options.infile)) {
            options.releaseCount = 0;
        }

        return options;
    }
}

module.exports = ChangelogGenerator;
