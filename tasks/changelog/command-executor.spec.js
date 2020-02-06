const CommandExecutor = require('./command-executor');
const Code = require('code');
const Lab = require('lab');
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

    it('spawns a new process to run the given command', done => {
        childProcess = require('child_process');
        spawnSpy = sinon.spy(childProcess, "spawn");
        commandExecutor = new CommandExecutor(childProcess);

        commandExecutor.executeCommand('jest', ['xyz.js'], { config: 'config.js' }, () => {
            expect(spawnSpy.calledWith(
                require('npm-which')(__dirname).sync('jest'),
                ['--config', 'config.js', 'xyz.js'],
                { stdio: 'inherit' },
            )).to.equal(true);

            done();
        });
    });

    it('returns undefined if the process exits with a successful exit code', done => {
        processMock = {
            on: function(event, callback) { return callback(0); },
        };

        spawn = function() { return processMock; };

        doneCallBack = sinon.fake();
        commandExecutor = new CommandExecutor({ spawn });
        commandExecutor.executeCommand('jest', ['xyz.js'], { config: 'config.js' }, doneCallBack);

        expect(doneCallBack.calledWith(undefined)).to.equal(true);

        done();
    });

    it('returns error if the process exits with an unsuccessful exit code', done => {
        processMock = {
            on: function(event, callback) { return callback(1); },
        };

        spawn = function() { return processMock; };

        doneCallBack = sinon.fake();
        commandExecutor = new CommandExecutor({ spawn });
        commandExecutor.executeCommand('jest', ['xyz.js'], { config: 'config.js' }, doneCallBack);

        expect(doneCallBack.calledWith(undefined)).to.equal(false);

        done();
    });
});
