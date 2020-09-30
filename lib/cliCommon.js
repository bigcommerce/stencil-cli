const semver = require('semver');
const { PACKAGE_INFO } = require('../constants');

const messages = {
    visitTroubleshootingPage:
        'Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads.',
    submitGithubIssue:
        'If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.',
};

/**
 * @param {Error} error
 * @param {Array<{message: string}>} [error.messages]
 * @returns {void}
 */
function printCliResultError(error) {
    console.log(`\n\n${'not ok'.red} -- ${error || 'Unknown error'}\n`);

    if (error && Array.isArray(error.messages)) {
        for (const item of error.messages) {
            if (item && item.message) {
                console.log(`${item.message.red}\n`);
            }
        }
    }

    console.log(messages.visitTroubleshootingPage);

    console.log(messages.submitGithubIssue);
}

/**
 * @param {Error} error
 * @returns {void}
 */
function printCliResultErrorAndExit(error) {
    printCliResultError(error);
    // Exit with error code so automated systems recognize it as a failure
    // eslint-disable-next-line no-process-exit
    process.exit(1);
}

function checkNodeVersion() {
    const satisfies = semver.satisfies(process.versions.node, PACKAGE_INFO.engines.node);

    if (!satisfies) {
        throw new Error(
            `You are running an unsupported version of node. Please upgrade to ${PACKAGE_INFO.engines.node}`,
        );
    }

    return satisfies;
}

module.exports = {
    messages,
    printCliResultError,
    printCliResultErrorAndExit,
    checkNodeVersion,
};
