const semver = require('semver');
const { PACKAGE_INFO } = require('../constants');

module.exports = function () {
    const satisfies = semver.satisfies(process.versions.node, PACKAGE_INFO.engines.node);

    if (!satisfies) {
        console.error('You are running an unsupported version of node. Please upgrade to ' + PACKAGE_INFO.engines.node);
    }

    return satisfies;
};
