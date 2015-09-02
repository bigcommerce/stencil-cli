var ChildProcess = require('child_process');

function getShell() {
    if (process.platform === 'win32') {
        return { command: 'cmd', arg: '/C' };
    } else {
        return { command: 'sh', arg: '-c' };
    }
}

/**
 * Execute shell command
 * @param {string} command Shell command to execute
 * @return {ChildProcess}
 */
function exec(command) {
    var shell = getShell(),
        args = [shell.arg, command],
        options = { stdio: 'inherit' };

    return ChildProcess.spawn(shell.command, args, options);
}

/**
 * Execute shell command synchronously
 * @param {string} command Shell command to execute
 * @return {Object}
 */
function execSync(command) {
    var shell = getShell(),
        args = [shell.arg, command],
        options = { stdio: 'inherit' };

    return ChildProcess.spawnSync(shell.command, args, options);
}

module.exports = {
    exec: exec,
    execSync: execSync
};
