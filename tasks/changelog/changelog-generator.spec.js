const ChangelogGenerator = require('./changelog-generator');
const CommandExecutor = require('./command-executor');
const Code = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const sinon = require('sinon');
const expect = Code.expect;
const it = lab.it;
const path = require('path');
const { promisify } = require('util');

describe('ChangelogGenerator', () => {
    let changelogGenerator;
    let commandExecutor;
    let fs;
    let executeCommandSpy;

    lab.beforeEach( () => {
        fs = {
            statSync: function() { return true; },
        };

        commandExecutor = new CommandExecutor(require('child_process'));
        executeCommandSpy = sinon.spy(commandExecutor, "executeCommand");

        changelogGenerator = new ChangelogGenerator(fs, '/src', commandExecutor);
    });

    it('executes `conventional-changelog` command', async() => {
        try {
            await promisify(changelogGenerator.generateChangelog.bind(changelogGenerator))({});

            // The generator will throw an error since '/src' doesn't exist, but we don't care,
            //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

        expect(executeCommandSpy.secondCall.calledWith(
            'conventional-changelog',
            [],
            {
                config: path.join(__dirname, 'default-config.js'),
                infile: path.join('/src', 'CHANGELOG.md'),
                sameFile: true,
            },
        )).to.equal(true);
    });

    it('executes `conventional-changelog` command with a preset if it is provided', async() => {
        try {
            await promisify(changelogGenerator.generateChangelog.bind(changelogGenerator))({ preset: 'angular' });

        // The generator will throw an error since '/src' doesn't exist, but we don't care,
        //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

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
    });

    it('executes `conventional-changelog` command from scratch if CHANGELOG does not exist', async() => {
        const changelogGeneratorWithoutFs = new ChangelogGenerator({}, '/src', commandExecutor);

        try {
            await promisify(changelogGeneratorWithoutFs.generateChangelog.bind(changelogGeneratorWithoutFs))({});

            // The generator will throw an error since '/src' doesn't exist, but we don't care,
            //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

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
    });
});
