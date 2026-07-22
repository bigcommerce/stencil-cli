const { parserOpts, types } = require('./commit-format.cjs');

module.exports = {
    extends: ['@commitlint/config-conventional'],
    parserPreset: { parserOpts },
    rules: {
        'subject-case': [0, 'always', 'sentence-case'],
        'type-enum': [2, 'always', types],
    },
};
