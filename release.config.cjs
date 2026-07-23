const { parserOpts } = require('./commit-format.cjs');

module.exports = {
    branches: ['master'],
    // eslint-disable-next-line no-template-curly-in-string
    tagFormat: '${version}',
    plugins: [
        ['@semantic-release/commit-analyzer', { parserOpts }],
        ['@semantic-release/release-notes-generator', { parserOpts }],
        '@semantic-release/changelog',
        '@semantic-release/github',
        '@semantic-release/npm',
        [
            'semantic-release-github-pullrequest-fixed',
            {
                assets: ['CHANGELOG.md', 'package.json'],
                baseRef: 'master',
            },
        ],
    ],
};
