// Shared commit message parser used by commitlint (commitlint.config.cjs) and
// semantic-release (release.config.cjs). Accepts both the BigCommerce ticket-first
// format enforced by @bigcommerce/validate-commits and the legacy conventional format:
//   TRAC-123: type(scope) - subject
//   type(scope): TRAC-123 subject
const parserOpts = {
    headerPattern: /^(?:[A-Z0-9]{2,}-\d+: )?(\w+)(?:\(([^)]*)\))?!?(?::| -) (.+)$/,
    breakingHeaderPattern: /^(?:[A-Z0-9]{2,}-\d+: )?(\w+)(?:\(([^)]*)\))?!(?::| -) (.+)$/,
    headerCorrespondence: ['type', 'scope', 'subject'],
};

// Union of @commitlint/config-conventional and @bigcommerce/validate-commits types
const types = [
    'build',
    'chore',
    'ci',
    'docs',
    'feat',
    'fix',
    'license',
    'meta',
    'perf',
    'ref',
    'refactor',
    'revert',
    'style',
    'test',
];

module.exports = { parserOpts, types };
