const semver = require('semver');
const { PACKAGE_INFO } = require('../constants');
const stencilCLISettings = require('./StencilCLISettings');

const messages = {
    visitTroubleshootingPage:
        'Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads.',
    submitGithubIssue:
        'If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.',
};

/**
 * @param {Object} object

 * @returns {void}
 */
function printObject(object) {
    for (const property of Object.keys(object)) {
        console.log(`${property}: ${object[property]}`);
    }
}

/**
 * @param {Error} error

 * @returns {void}
 */
function printNetworkError(config) {
    console.log(`URL: `.yellow + config.url);
    console.log(`Method: `.yellow + config.method.toUpperCase());
    if (config.data) {
        console.log(`Data: `.yellow);
        printObject(config.data);
    }
}

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

    if (error && (error.config || error.response)) {
        // In case if request didn't receive any response, response object is not available
        const networkReq = error.config || error.response;
        printNetworkError(networkReq);
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

function applyCommonOptions(program) {
    program
        .option('-h, --host [hostname]', 'specify the api host')
        .option('-nov, --no-verbose', 'supress verbose info logging', false)
        .option(
            '--use-old-node-sass-fork',
            'use old node sass fork for scss compilation during bundling',
            false,
        )
        .parse(process.argv);
}

function setupCLI(options) {
    stencilCLISettings.setVerbose(options.verbose);
    stencilCLISettings.useOldNodeSassFork(options.useOldNodeSassFork);
}

function prepareCommand(program) {
    applyCommonOptions(program);
    checkNodeVersion();

    const options = program.opts();
    setupCLI(options);

    return options;
}

module.exports = {
    messages,
    printCliResultError,
    printCliResultErrorAndExit,
    checkNodeVersion,
    prepareCommand,
};
