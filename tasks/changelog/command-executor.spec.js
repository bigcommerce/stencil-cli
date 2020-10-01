const { promisify } = require('util');
const childProcess = require('child_process');
const which = require('npm-which');

const CommandExecutor = require('./command-executor');

describe('CommandExecutor', () => {
    it('spawns a new process to run the given command', async () => {
        const spawnSpy = jest.spyOn(childProcess, 'spawn').mockImplementation(jest.fn());
        const commandExecutor = new CommandExecutor(childProcess);
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        try {
            await executeCommand('jest', ['xyz.js'], { config: 'config.js' });

            // The executor will throw an error since '/xyz.js' doesn't exist, but we don't care,
            //  just need to make sure that spawnSpy was called properly
            // eslint-disable-next-line no-empty
        } catch (err) {}

        expect(spawnSpy).toHaveBeenCalledWith(
            which(__dirname).sync('jest'),
            ['--config', 'config.js', 'xyz.js'],
            { stdio: 'inherit' },
        );
    });

    // eslint-disable-next-line jest/expect-expect
    it('resolves successfully if the process exits with a successful exit code', async () => {
        const processMock = {
            on(event, callback) {
                return callback(0);
            },
        };
        const spawn = () => processMock;
        const commandExecutor = new CommandExecutor({ spawn });
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        await executeCommand('jest', ['xyz.js'], { config: 'config.js' });
    });

    it('throws an error if the process exits with an unsuccessful exit code', async () => {
        const processMock = {
            on(event, callback) {
                return callback(1);
            },
        };
        const spawn = () => processMock;
        const commandExecutor = new CommandExecutor({ spawn });
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        await expect(executeCommand('jest', ['xyz.js'], { config: 'config.js' })).rejects.toThrow();
    });
});
