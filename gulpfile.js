'use strict';
require('colors');
require('path');
const bump = require('gulp-bump');
const changelog = require('./tasks/changelog');
const constants = require('./constants');
const currentVersion = constants.packageInfo.version;
const exec = require('gulp-exec');
const git = require('gulp-git-streamed');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const supportedLockFileVersion = [1];
const prompt = require('gulp-prompt');
const semver = require('semver');

let branch;
let remote;
let responses;
let targetVersion;

function installPrivateDependencies() {
    return gulp.src('package.json')
        .pipe(exec('npm run install-private-dependencies'), logError)
        .on('error', logError);
}

function bumpTask() {
    const questions = [{
        type: 'list',
        name: 'type',
        message: 'What type of release would you like to do?',
        choices: [{
            value: 'patch',
            name: 'Patch:  '.yellow + semver.inc(currentVersion, 'patch').yellow + '   Backwards-compatible bug fixes.',
        }, {
            value: 'minor',
            name: 'Minor:  '.yellow + semver.inc(currentVersion, 'minor').yellow + '   Component release or significant update to existing one.',
        }, {
            value: 'major',
            name: 'Major:  '.yellow + semver.inc(currentVersion, 'major').yellow + '   Major UI refresh.',
        }, {
            value: 'custom',
            name: 'Custom: ?.?.?'.yellow + '   Specify version...',
        }],
    }, {
        type: 'input',
        name: 'custom-version',
        message: 'What specific version would you like',
        when: answers => answers['type'] === 'custom',
        validate: value => {
            const valid = semver.valid(value) && true;

            return valid || 'Must be a valid semver, such as 1.2.3';
        },
    }, {
        name: 'confirmPush',
        type: 'confirm',
        message: 'Do you want to push this new tag?',
    }, {
        name: 'pushTo',
        type: 'input',
        message:'Where would you like to push to?',
        default: 'origin master',
        when: answers => answers['confirmPush'],
        validate: pushResponse => pushResponse.split(' ').length === 2,
    }];

    return gulp.src('package.json')
        .pipe(prompt.prompt(questions, res => {
            const pushToSplit = res.pushTo.split(' ');

            remote = pushToSplit[0];
            branch = pushToSplit[1];
            targetVersion = (res.type !== 'custom') ? semver.inc(currentVersion, res.type) : res['custom-version'];
            responses = res;

            const packageLock = require('./package-lock.json');

            if (!supportedLockFileVersion.includes(packageLock["lockfileVersion"])) {
                throw new Error(`Release script only supports version ${supportedLockFileVersion}`);
            }

            return gulp.src(['package.json', 'package-lock.json'])
                // bump the version number in those files
                .pipe(bump({ version: targetVersion }))
                // save it back to filesystem
                .pipe(gulp.dest(process.cwd()))
                // change last modified date
                .pipe(exec('touch -c package.json'))
                // Fetch Remote Tags
                .pipe(git.exec({ args: `fetch ${remote} --tags` }, logError));
        }))
        .on('error', logError);
}

function deployWebpack() {
    return gulp.src('package.json')
        .pipe(exec('npm run deploy'), logError)
        .on('error', logError);
}

function uninstallPrivateDependencies() {
    return gulp.src('package.json')
        .pipe(exec('npm run uninstall-private-dependencies'), logError)
        .on('error', logError);
}

function pushTask() {
    return gulp.src(['package.json', 'package-lock.json', 'CHANGELOG.md', 'server/plugins/stencil-editor/public/dist/app.js', 'server/plugins/stencil-editor/public/dist/ng-stencil-editor/css/ng-stencil-editor.min.css', 'server/plugins/stencil-editor/public/dist/stencil-preview-sdk.js'])
        // Add files
        .pipe(git.add())
        // Commit the changed version number
        .pipe(git.commit(`docs(release): releasing ${targetVersion}`))
        // Create a Tag
        .pipe(git.tag(targetVersion, targetVersion, logError))
        // Push Changes
        .pipe(gulpif(responses.confirmPush, git.push(remote, branch, logError)))
        // Push Tags
        .pipe(gulpif(responses.confirmPush, git.push(remote, branch, { args: '--follow-tags' }, logError)))
        .on('error', logError);
}

function logError(err) {
    if (err) {
        gutil.log(err);
    }
}

gulp.task('install-private-dependencies', installPrivateDependencies);
gulp.task('bump', bumpTask);
gulp.task('deploy-webpack', deployWebpack);
gulp.task('changelog', (done) => changelog.changelogTask({}, done));
gulp.task('uninstall-private-dependencies', uninstallPrivateDependencies);
gulp.task('push', pushTask);
gulp.task('release', gulp.series('install-private-dependencies', 'bump', 'deploy-webpack', 'changelog', 'uninstall-private-dependencies', 'push'));
