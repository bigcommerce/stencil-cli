/**
 * @param {Object} commit
 * @return {Object}
 */
function transform(commit) {
    if (/^Releasing \d+\.\d+\.\d+/.test(commit.header)) {
        return false;
    }

    commit.hash = commit.hash.slice(0, 7);
    commit.references = [];

    return commit;
}

const defaultConfig = {
    writerOpts: {
        transform,
    },
};

module.exports = defaultConfig;
