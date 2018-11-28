const createChangelogTask = require('./changelog-task');
const ChangelogGenerator = require('./changelog-generator');
const CommandExecutor = require('./command-executor');

const commandExecutor = new CommandExecutor(require('child_process'));
const changelogGenerator = new ChangelogGenerator(require('fs'), process.cwd(), commandExecutor);

module.exports = {
    changelogTask: createChangelogTask(changelogGenerator),
};
