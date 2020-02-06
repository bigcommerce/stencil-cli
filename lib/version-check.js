var pkg = require('../package.json');
var semver = require('semver');

module.exports = function () {
    var satisfies = semver.satisfies(process.versions.node, pkg.engines.node);

    if (!satisfies) {
        console.error('You are running an older version of node. Please upgrade to ' + pkg.engines.node);
    }

    return satisfies;
};
