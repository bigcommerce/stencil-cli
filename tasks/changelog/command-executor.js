const toSpawnArgs = require('object-to-spawn-args');
const which = require('npm-which');

class CommandExecutor {
    /**
     * @param {Object} childProcess
     * @constructor
     */
    constructor(childProcess) {
        this.childProcess = childProcess;
    }

    /**
     * @param {string} executable
     * @param {string[]} argv
     * @param {Object} options
     * @param {function(error: Error?): void} done
     * @returns {void}
     */
    executeCommand(executable, argv, options, done) {
        const command = this._createCommand(executable, argv, options);

        this.childProcess
            .spawn(command.executable, command.args, command.options)
            .on('close', (code) => {
                done(code ? new Error(`Exit code: ${code}`) : undefined);
            });
    }

    /**
     * @private
     * @param {string} executable
     * @param {string[]} [argv=[]]
     * @param {Object} [options={}]
     * @returns {Object}
     */
    _createCommand(executable, argv = [], options = {}) {
        const executablePath = which(__dirname).sync(executable);
        const spawnArgs = toSpawnArgs(options);
        const spawnOptions = { stdio: 'inherit' };

        return {
            executable: executablePath,
            args: spawnArgs.concat(argv),
            options: spawnOptions,
        };
    }
}

module.exports = CommandExecutor;
