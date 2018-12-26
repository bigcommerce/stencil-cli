const path = require('path');

/**
 * @param {Object} fs
 * @param {string} cwd
 * @param {Object} commandExecutor
 * @constructor
 */
function ChangelogGenerator(fs, cwd, commandExecutor) {
    /**
     * @param {ChangelogOptions} customOptions
     * @param {function(error: Error?): void} done
     * @return {void}
     */
    function generateChangelog(customOptions, done) {
        const options = getOptions(customOptions);
        commandExecutor.executeCommand('touch', ['package.json'], {}, () => {
            commandExecutor.executeCommand('conventional-changelog', [], options, done);
        });
    }

    /**
     * @private
     * @param {ChangelogOptions} [customOptions={}]
     * @return {ChangelogOptions}
     */
    function getOptions(customOptions) {
        customOptions = customOptions ? customOptions : {};
        const options = Object.assign({
            config: customOptions.preset ? undefined : path.join(__dirname, 'default-config.js'),
            infile: path.join(cwd, 'CHANGELOG.md'),
            sameFile: true,
        }, customOptions);

        try {
            fs.statSync(options.infile);
        } catch(error) {
            options.releaseCount = 0;
        }

        return options;
    }

    this.generateChangelog = generateChangelog;
}

module.exports = ChangelogGenerator;
