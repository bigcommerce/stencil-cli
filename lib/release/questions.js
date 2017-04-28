'use strict';

const inquirer = require('inquirer');
const semver = require('semver');
const dateformat = require('dateformat');

function askQuestions(themeConfig, githubToken, remotes, callback) {
    const remoteChoices = remotes.map(remote => {
        return { value: remote,  name: `${remote.name}: ${remote.url}` };
    })

    const currentVersion = themeConfig.getVersion();

    const questions = [
        {
            name: 'version',
            type: 'list',
            message: 'What type of release would you like to do? ' + 'Current version: '.cyan + currentVersion,
            choices: [{
                value: 'patch',
                name: 'Patch:  '.yellow + semver.inc(currentVersion, 'patch').yellow + '   Backwards-compatible bug fixes.',
            },
            {
                value: 'minor',
                name: 'Minor:  '.yellow + semver.inc(currentVersion, 'minor').yellow + '   Feature release or significant update.',
            },
            {
                value: 'major',
                name: 'Major:  '.yellow + semver.inc(currentVersion, 'major').yellow + '   Major change.',
            },
            {
                value: 'custom',
                name: 'Custom: ?.?.?'.yellow + '   Specify version...',
            }],
            filter: bumpType => semver.inc(currentVersion, bumpType),
        },
        {
            name: 'version',
            type: 'input',
            message: 'What specific version would you like',
            when: answers => !answers['version'],
            validate: value => {
                const valid = semver.valid(value) && true;

                return valid || 'Must be a valid semver, such as 1.2.3';
            },
        },
        {
            name: 'remote',
            type: 'list',
            message: 'What git remote repository would you like to push the release to?',
            choices: remoteChoices,
        },
        {
            name: 'createGithubRelease',
            type: 'confirm',
            message: 'Create a github release and upload the bundle zip file?',
        },
        {
            name: 'githubToken',
            type: 'input',
            message: 'Github token?',
            when: answers => {
                answers.githubToken = githubToken;
                return answers.createGithubRelease && !githubToken;
            },
        },
        {
            name: 'proceed',
            type: 'confirm',
            message: 'Proceed?',
        },
    ];

    inquirer.prompt(questions, answers => {
        if (!answers.proceed) {
            return callback(new Error('Operation cancelled'));
        }

        answers.date = dateformat(new Date(), 'yyyy-mm-dd');

        callback(null, answers);
    });
}

module.exports = askQuestions;
