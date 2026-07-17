// Decoy config: stencil.conf.mjs in this directory must take precedence.
// If the CLI loads or forks this file instead, the esm-config tests fail
// (wrong watchOptions, and no worker protocol so the fork exits immediately).
const watchOptions = {
    files: ['/cjs-config-should-not-be-loaded'],
    ignored: [],
};

module.exports = { watchOptions };
