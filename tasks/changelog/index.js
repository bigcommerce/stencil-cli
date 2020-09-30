const childProcess = require('child_process');
const fs = require('fs');

const createChangelogTask = require('./changelog-task');
const ChangelogGenerator = require('./changelog-generator');
const CommandExecutor = require('./command-executor');

const commandExecutor = new CommandExecutor(childProcess);
const changelogGenerator = new ChangelogGenerator(fs, process.cwd(), commandExecutor);

module.exports = {
    changelogTask: createChangelogTask(changelogGenerator),
};
