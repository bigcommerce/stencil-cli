const CommandExecutor = require('./command-executor');
const { promisify } = require('util');
const Code = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const sinon = require('sinon');
const expect = Code.expect;
const it = lab.it;

describe('CommandExecutor', () => {
    let commandExecutor;
    let childProcess;
    let spawnSpy;
    let processMock;
    let spawn;
    let doneCallBack;

    it('spawns a new process to run the given command', async () => {
        childProcess = require('child_process');
        spawnSpy = sinon.spy(childProcess, "spawn");
        commandExecutor = new CommandExecutor(childProcess);
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        try {
            await executeCommand('jest', ['xyz.js'], { config: 'config.js' });

            // The executor will throw an error since '/xyz.js' doesn't exist, but we don't care,
            //  just need to make sure that spawnSpy was called properly
        } catch (err) {}

        expect(spawnSpy.calledWith(
            require('npm-which')(__dirname).sync('jest'),
            ['--config', 'config.js', 'xyz.js'],
            { stdio: 'inherit' },
        )).to.equal(true);
    });

    it('resolves successfully if the process exits with a successful exit code', async () => {
        processMock = {
            on: function(event, callback) { return callback(0); },
        };
        spawn = function() { return processMock; };
        commandExecutor = new CommandExecutor({ spawn });
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        await executeCommand('jest', ['xyz.js'], { config: 'config.js' });
    });

    it('throws an error if the process exits with an unsuccessful exit code', async () => {
        processMock = {
            on: function(event, callback) { return callback(1); },
        };
        spawn = function() { return processMock; };
        commandExecutor = new CommandExecutor({ spawn });
        const executeCommand = promisify(commandExecutor.executeCommand.bind(commandExecutor));

        let error;
        try {
            await executeCommand('jest', ['xyz.js'], {config: 'config.js'}, doneCallBack);
        } catch (err) {
            error = err;
        }

        expect(error).to.be.an.error();
    });
});
