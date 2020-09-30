/**
 * @param {Object} commit
 * @returns {Object}
 */
function transform(commit) {
    if (/^Releasing \d+\.\d+\.\d+/.test(commit.header)) {
        return false;
    }

    // eslint-disable-next-line no-param-reassign
    commit.hash = commit.hash.slice(0, 7);
    // eslint-disable-next-line no-param-reassign
    commit.references = [];

    return commit;
}

const defaultConfig = {
    writerOpts: {
        transform,
    },
};

module.exports = defaultConfig;
