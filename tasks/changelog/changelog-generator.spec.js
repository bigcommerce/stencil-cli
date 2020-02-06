const ChangelogGenerator = require('./changelog-generator');
const CommandExecutor = require('./command-executor');
const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const sinon = require('sinon');
const expect = Code.expect;
const it = lab.it;
const path = require('path');

describe('ChangelogGenerator', () => {
    let changelogGenerator;
    let commandExecutor;
    let fs;
    let executeCommandSpy;

    lab.beforeEach( done => {
        fs = {
            statSync: function() { return true; },
        };

        commandExecutor = new CommandExecutor(require('child_process'));
        executeCommandSpy = sinon.spy(commandExecutor, "executeCommand");

        changelogGenerator = new ChangelogGenerator(fs, '/src', commandExecutor);

        done();
    });

    it('executes `conventional-changelog` command', done => {
        changelogGenerator.generateChangelog({}, () => {
            expect(executeCommandSpy.secondCall.calledWith(
                'conventional-changelog',
                [],
                {
                    config: path.join(__dirname, 'default-config.js'),
                    infile: path.join('/src', 'CHANGELOG.md'),
                    sameFile: true,
                },
            )).to.equal(true);

            done();
        });
    });

    it('executes `conventional-changelog` command with a preset if it is provided', done => {
        changelogGenerator.generateChangelog({ preset: 'angular' }, () => {

            expect(executeCommandSpy.secondCall.calledWith(
            'conventional-changelog',
            [],
            {
                config: undefined,
                infile: path.join('/src', 'CHANGELOG.md'),
                preset: 'angular',
                sameFile: true,
            },
            )).to.equal(true);

            done();
        });
    });

    it('executes `conventional-changelog` command from scratch if CHANGELOG does not exist', done => {
        var changelogGeneratorWithoutFs = new ChangelogGenerator({}, '/src', commandExecutor);

        changelogGeneratorWithoutFs.generateChangelog({}, () => {

        expect(executeCommandSpy.secondCall.calledWith(
            'conventional-changelog',
            [],
            {
                config: path.join(__dirname, 'default-config.js'),
                infile: path.join('/src', 'CHANGELOG.md'),
                releaseCount: 0,
                sameFile: true,
            },
            )).to.equal(true);

            done();
        });
    });
});
