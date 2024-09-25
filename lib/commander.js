import program from 'commander';

program
    // Avoid option name clashes https://www.npmjs.com/package/commander#avoiding-option-name-clashes
    .storeOptionsAsProperties(false)
    .passCommandToAction(false);
export default program;
