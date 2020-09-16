const path = require('path');
const { promisify } = require('util');

const ChangelogGenerator = require('./changelog-generator');
const CommandExecutor = require('./command-executor');

describe('ChangelogGenerator', () => {
    let changelogGenerator;
    let commandExecutor;
    let fsMock;
    let executeCommandSpy;

    beforeEach( () => {
        fsMock = {
            existsSync: () => true,
        };

        commandExecutor = new CommandExecutor(require('child_process'));
        executeCommandSpy = jest.spyOn(commandExecutor, "executeCommand")
            .mockImplementation((executable, argv, options, done) => done());

        changelogGenerator = new ChangelogGenerator(fsMock, '/src', commandExecutor);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('executes `conventional-changelog` command', async() => {
        try {
            await promisify(changelogGenerator.generateChangelog.bind(changelogGenerator))({});

            // The generator will throw an error since '/src' doesn't exist, but we don't care,
            //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

        expect(executeCommandSpy).toHaveBeenNthCalledWith(
            2,
            'conventional-changelog',
            [],
            {
                config: path.join(__dirname, 'default-config.js'),
                infile: path.join('/src', 'CHANGELOG.md'),
                sameFile: true,
            },
            expect.any(Function),
        );
    });

    it('executes `conventional-changelog` command with a preset if it is provided', async() => {
        try {
            await promisify(changelogGenerator.generateChangelog.bind(changelogGenerator))({ preset: 'angular' });

        // The generator will throw an error since '/src' doesn't exist, but we don't care,
        //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

        expect(executeCommandSpy).toHaveBeenNthCalledWith(
            2,
            'conventional-changelog',
            [],
            {
                config: undefined,
                infile: path.join('/src', 'CHANGELOG.md'),
                preset: 'angular',
                sameFile: true,
            },
            expect.any(Function),
        );
    });

    it('executes `conventional-changelog` command from scratch if CHANGELOG does not exist', async() => {
        const fsMock = {
            existsSync: () => false,
        };
        const changelogGeneratorWithoutFs = new ChangelogGenerator(fsMock, '/src', commandExecutor);

        try {
            await promisify(changelogGeneratorWithoutFs.generateChangelog.bind(changelogGeneratorWithoutFs))({});

            // The generator will throw an error since '/src' doesn't exist, but we don't care,
            //  just need to make sure that executeCommandSpy was called properly
        } catch (err) {}

        expect(executeCommandSpy).toHaveBeenNthCalledWith(
            2,
            'conventional-changelog',
            [],
            {
                config: path.join(__dirname, 'default-config.js'),
                infile: path.join('/src', 'CHANGELOG.md'),
                releaseCount: 0,
                sameFile: true,
            },
            expect.any(Function),
        );
    });
});
