/**
 * Please see `conventional-changelog-cli` README for available options
 * @typedef {Object} ChangelogOptions
 * @property {string|undefined} config
 * @property {string|undefined} preset
 * @property {string|undefined} infile
 * @property {boolean|undefined} sameFile
 */

/**
 * @param {ChangelogGenerator} changelogGenerator
 * @returns {Function}
 */
function createChangelogTask(changelogGenerator) {
    /**
     * @param {Object} options
     * @param {ChangelogOptions} options.changelog
     * @param {function(error: Error?): void} done
     * @returns {void}
     */
    function changelogTask(options, done) {
        if (options.bumpType === 'none') {
            done();
            return;
        }

        changelogGenerator.generateChangelog(options.changelog, done);
    }

    return changelogTask;
}

module.exports = createChangelogTask;
