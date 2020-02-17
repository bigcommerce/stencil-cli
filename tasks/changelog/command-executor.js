const toSpawnArgs = require('object-to-spawn-args');
const which = require('npm-which')(__dirname);

/**
 * @param {Object} childProcess
 * @constructor
 */
function CommandExecutor(childProcess) {
    /**
     * @param {string} executable
     * @param {string[]} argv
     * @param {Object} options
     * @param {function(error: Error?): void} done
     * @return {void}
     */
    function executeCommand(executable, argv, options, done) {
        const command = createCommand(executable, argv, options);
        
        childProcess.spawn(command.executable, command.args, command.options)
            .on('close', code => {
                done(code ? new Error(`Exit code: ${code}`) : undefined);
            });
    }

    /**
     * @private
     * @param {string} executable
     * @param {string[]} [argv=[]]
     * @param {Object} [options={}]
     * @return {Object}
     */
    function createCommand(executable, argv, options) {
        argv = argv ? argv : [];
        options = options ? options : {};
        const executablePath = which.sync(executable);
        const spawnArgs = toSpawnArgs(options);
        const spawnOptions = { stdio: 'inherit' };

        return {
            executable: executablePath,
            args: spawnArgs.concat(argv),
            options: spawnOptions,
        };
    }

    this.executeCommand = executeCommand;
}

module.exports = CommandExecutor;
