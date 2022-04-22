require('colors');
const program = require('../lib/commander');

const StencilDebug = require('../lib/StencilDebug');
const { PACKAGE_INFO } = require('../constants');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-o, --output [filename]', 'If provided will write to file')
    .parse(process.argv);

const cliOptions = program.opts();

new StencilDebug().run(cliOptions).catch(printCliResultErrorAndExit);
