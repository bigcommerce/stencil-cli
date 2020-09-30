/**
 * These gulp tasks are used to release stencil-cli itself
 * (in contrast with /bin/stencil-release.js which is used to release themes)
 */

/* eslint-disable node/no-unpublished-require */
require('colors');
require('path');
const bump = require('gulp-bump');
const exec = require('gulp-exec');
const git = require('gulp-git-streamed');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const prompt = require('gulp-prompt');
const semver = require('semver');

const changelog = require('./tasks/changelog');
const { PACKAGE_INFO } = require('./constants');
const packageLock = require('./package-lock.json');

const currentVersion = PACKAGE_INFO.version;
const supportedLockFileVersion = [1];
let branch;
let remote;
let responses;
let targetVersion;

function logError(err) {
    if (err) {
        gutil.log(err);
    }
}

function bumpTask() {
    const nextPatchVersion = semver.inc(currentVersion, 'patch');
    const nextMinorVersion = semver.inc(currentVersion, 'minor');
    const nextMajorVersion = semver.inc(currentVersion, 'major');
    const questions = [
        {
            type: 'list',
            name: 'type',
            message: 'What type of release would you like to do?',
            choices: [
                {
                    value: 'patch',
                    name:
                        'Patch:  '.yellow +
                        nextPatchVersion.yellow +
                        '   Backwards-compatible bug fixes.',
                },
                {
                    value: 'minor',
                    name:
                        'Minor:  '.yellow +
                        nextMinorVersion.yellow +
                        '   Component release or significant update to existing one.',
                },
                {
                    value: 'major',
                    name: 'Major:  '.yellow + nextMajorVersion.yellow + '   Major UI refresh.',
                },
                {
                    value: 'custom',
                    name: 'Custom: ?.?.?'.yellow + '   Specify version...',
                },
            ],
        },
        {
            type: 'input',
            name: 'custom-version',
            message: 'What specific version would you like',
            when: (answers) => answers.type === 'custom',
            validate: (value) => {
                const valid = semver.valid(value) && true;

                return valid || 'Must be a valid semver, such as 1.2.3';
            },
        },
        {
            name: 'confirmPush',
            type: 'confirm',
            message: 'Do you want to push this new tag?',
        },
        {
            name: 'pushTo',
            type: 'input',
            message: 'Where would you like to push to?',
            default: 'origin master',
            when: (answers) => answers.confirmPush,
            validate: (pushResponse) => pushResponse.split(' ').length === 2,
        },
    ];

    return gulp
        .src('package.json')
        .pipe(
            prompt.prompt(questions, (res) => {
                [remote, branch] = res.pushTo.split(' ');
                targetVersion =
                    res.type !== 'custom'
                        ? semver.inc(currentVersion, res.type)
                        : res['custom-version'];
                responses = res;

                if (!supportedLockFileVersion.includes(packageLock.lockfileVersion)) {
                    throw new Error(
                        `Release script only supports version ${supportedLockFileVersion}`,
                    );
                }

                return (
                    gulp
                        .src(['package.json', 'package-lock.json'])
                        // bump the version number in those files
                        .pipe(bump({ version: targetVersion }))
                        // save it back to filesystem
                        .pipe(gulp.dest(process.cwd()))
                        // change last modified date
                        .pipe(exec('touch -c package.json'))
                        // Fetch Remote Tags
                        .pipe(git.exec({ args: `fetch ${remote} --tags` }, logError))
                );
            }),
        )
        .on('error', logError);
}

function pushTask() {
    return (
        gulp
            .src(['package.json', 'package-lock.json', 'CHANGELOG.md'])
            // Add files
            .pipe(git.add())
            // Commit the changed version number
            .pipe(git.commit(`docs(release): releasing ${targetVersion}`))
            // Create a Tag
            .pipe(git.tag(targetVersion, targetVersion, logError))
            // Push Changes
            .pipe(gulpif(responses.confirmPush, git.push(remote, branch, logError)))
            // Push Tags
            .pipe(
                gulpif(
                    responses.confirmPush,
                    git.push(remote, branch, { args: '--follow-tags' }, logError),
                ),
            )
            .on('error', logError)
    );
}

gulp.task('bump', bumpTask);
gulp.task('changelog', (done) => changelog.changelogTask({}, done));
gulp.task('push', pushTask);
gulp.task('release', gulp.series('bump', 'changelog', 'push'));
