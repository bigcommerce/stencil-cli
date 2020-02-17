'use strict';

const inquirer = require('inquirer');
const semver = require('semver');
const dateFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

function askQuestions(themeConfig, githubToken, remotes, callback) {
    const remoteChoices = remotes.map(remote => {
        return { value: remote,  name: `${remote.name}: ${remote.url}` };
    });

    const currentVersion = themeConfig.getVersion();

    const nextPatchVersion = semver.inc(currentVersion, 'patch');
    const nextMinorVersion = semver.inc(currentVersion, 'minor');
    const nextMajorVersion = semver.inc(currentVersion, 'major');
    const nextReleaseCandidate = currentVersion.includes('-rc.') ?
      semver.inc(currentVersion, 'prerelease', 'rc') :
      semver.inc(currentVersion, 'minor') + '-rc.1';

    const questions = [
        {
            name: 'version',
            type: 'list',
            message: 'What type of release would you like to do? ' + 'Current version: '.cyan + currentVersion,
            choices: [{
                name: 'Release Candidate:  '.yellow + nextReleaseCandidate.yellow + '   Internal release for testing.',
                value: nextReleaseCandidate,
            },
            {
                name: 'Patch:  '.yellow + nextPatchVersion.yellow + '   Backwards-compatible bug fixes.',
                value: nextPatchVersion,
            },
            {
                name: 'Minor:  '.yellow + nextMinorVersion.yellow + '   Feature release or significant update.',
                value: nextMinorVersion,
            },
            {
                name: 'Major:  '.yellow + nextMajorVersion.yellow + '   Major change.',
                value: nextMajorVersion,
            },
            {
                name: 'Custom: ?.?.?'.yellow + '   Specify version...',
                value: 'custom',
            }],
        },
        {
            name: 'version',
            type: 'input',
            message: 'What specific version would you like',
            when: answers => answers['version'] === 'custom',
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

        answers.date = new Date().toLocaleString('en-US', dateFormatOptions).split('/').join('-');

        callback(null, answers);
    });
}

module.exports = askQuestions;
