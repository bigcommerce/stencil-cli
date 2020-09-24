const messages = {
    visitTroubleshootingPage: 'Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads.',
    submitGithubIssue: 'If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.',
};

/**
 * @param {Error} error
 * @param {Array<{message: string}>} [error.messages]
 * @returns {void}
 */
function printCliResultError (error) {
    console.log('\n\n' + 'not ok'.red + ` -- ` + (error || 'Unknown error') + '\n');

    if (error && Array.isArray(error.messages)) {
        for (let item of error.messages) {
            if (item && item.message) {
                console.log(item.message.red + '\n');
            }
        }
    }

    console.log(messages.visitTroubleshootingPage);

    console.log(messages.submitGithubIssue);
}

module.exports = {
    printCliResultError,
    messages,
};
