'use strict';

const os = require('os');
const uuid = require('uuid4');
const fs = require('fs');
const path = require('path');
const themePath = process.cwd();
const git = require('simple-git')(themePath);
const themeConfig = require('../theme-config').getInstance(themePath);
const questions = require('./questions');
const GitHub = require('github');
const Bundle = require('../stencil-bundle');

module.exports = () => {

    getGitData((err, gitData) => {
        if (err) {
            throw err;
        }

        if (gitData.remotes.length === 0) {
            return printError('No git remote repository found');
        }

        if (gitData.current !== 'master') {
            return printError('Not on master branch, please checkout master branch to proceed');
        }

        if (gitData.dirty) {
            return printError('git tree is dirty, please commit changes to proceed');
        }

        if (gitData.behind !== 0) {
            return printError(`Your branch is behind by ${gitData.behind} commits`);
        }

        if (gitData.ahead !== 0) {
            printWarning(`your branch is ahead by ${gitData.ahead} commits`);
        }

        questions(themeConfig, getGithubToken(), gitData.remotes, (err, answers) => {
            if (err) {
                return printError(err.message);
            }

            saveGithubToken(answers.githubToken);

            doRelease(answers, err => {
                if (err) {
                    return printError(err.message);
                }

                console.log('done'.green);
            });
        });
    });
};

function doRelease(options, callback) {
    // Update changelog and get text for release notes
    const changelog = parseChangelog(options.version, options.date);

    bumpJsonFileVersion(path.join(themePath, 'config.json'), options.version);
    bumpJsonFileVersion(path.join(themePath, 'package.json'), options.version);

    bundleTheme((err, bundlePath) => {
        if (err) {
            return callback(err);
        }

        commitAndPush(options.version, options.remote, (err, commit) => {
            if (err) {
                fs.unlinkSync(bundlePath);
                return callback(err);
            }

            createRelease(options, commit, bundlePath, changelog, err => {
                fs.unlinkSync(bundlePath);
                if (err) {
                    return callback(err);
                }

                callback();
            });
        });
    });
}

function commitAndPush(version, remote, callback) {
    git.add(['config.json', 'package.json', 'CHANGELOG.md']).commit(`Releasing ${version}`, (err, summary) => {
        if (err) {
            return callback(err);
        }

        console.log(`Pushing Changes to ${remote.name}...`);

        git.push(remote.name, 'master', err => {
            if (err) {
                return callback(err);
            }

            callback(null, summary.commit);
        });
    });
}

function createRelease(options, commit, bundlePath, changelog, callback) {
    if (options.createGithubRelease) {
        createGithubRelease(commit, options.version, changelog, options.remote, bundlePath, callback);
    } else {
        process.nextTick(callback);
    }
}

function createGithubRelease(commit, version, changelog, remote, bundlePath, callback) {
    const github = getGithubClient();

    const releaseParams = {
        owner: remote.owner,
        repo: remote.repo,
        tag_name: version,
        body: changelog || '',
        prerelease: isReleaseCandidate(version),
    };

    console.log('Creating Github Release...');

    github.repos.createRelease(releaseParams)
        .then(release => {
            const uploadParams = {
                id: release.id,
                owner: remote.owner,
                repo: remote.repo,
                filePath: bundlePath,
                name: `${themeConfig.getName()}-${version}.zip`,
            };

            console.log('Uploading Bundle File...');

            github.repos.uploadAsset(uploadParams)
                .then(asset => {
                    console.log(`Release url: ${release.html_url.green}`);
                    console.log(`Bundle download url: ${asset.browser_download_url.green}`);

                    callback();
                })
                .catch(callback);
        })
        .catch(callback);
}

function bumpJsonFileVersion(filePath, version) {
    const data = JSON.parse(fs.readFileSync(filePath));

    data.version = version;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function parseChangelog(version, date) {
    const filePath = path.join(themePath, 'CHANGELOG.md');
    var changelog = '';

    try {
        changelog = fs.readFileSync(filePath).toString();
    } catch (e) {
        // no CHANGELOG file
        return null;
    }

    const match = changelog.match(/##\s*?draft\s*?\n([\s\S]*?)(##|$)/i);

    // bump the version and date
    changelog = changelog.replace(/##\s*?draft\s*?\n/i, `## Draft\n\n## ${version} (${date})\n`);

    // Update the changelog file if this is a full release
    if (!isReleaseCandidate(version)) {
        fs.writeFileSync(filePath, changelog);
    }

    return match ? match[1].trim() : null;
}

function saveGithubToken(githubToken) {
    const dotStencilPath = path.join(themePath, '.stencil');
    var data = {};

    try {
        data = JSON.parse(fs.readFileSync(dotStencilPath));
    } catch (e) {
        // .stencil file might not exist
    }

    data.githubToken = githubToken;
    fs.writeFileSync(dotStencilPath, JSON.stringify(data, null, 2) + '\n');
}

function getGithubToken() {
    const dotStencilPath = path.join(themePath, '.stencil');
    var data = {};

    try {
        data = JSON.parse(fs.readFileSync(dotStencilPath));
    } catch (e) {
        // .stencil file might not exist
    }

    return data.githubToken;
}

function bundleTheme(callback) {
    const bundle = new Bundle(themePath, themeConfig, themeConfig.getRawConfig(), {
        dest: os.tmpdir(),
        name: uuid(),
    });

    bundle.initBundle(callback);
}

function getGitData(callback) {
    git.status((err, status) => {
        if (err) {
            return callback(err);
        }

        git.getRemotes(true, (err, response) => {
            if (err) {
                return callback(err);
            }

            const remotes = response.map(remote => {
                const url = remote.refs.push || '';
                const match = url.match(/github\.com[\/|:](.+?)\/(.+?)[\/|\.]/);

                return {
                    name: remote.name,
                    url,
                    owner: match ? match[1] : null,
                    repo: match ? match[2] : null,
                };
            });

            const dirty = status.not_added.length > 0 ||
                status.conflicted.length > 0 ||
                status.created.length > 0 ||
                status.deleted.length > 0 ||
                status.modified.length > 0 ||
                status.renamed.length > 0;

            callback(null, Object.assign({ dirty }, status, { remotes }));
        });
    });
}

function printError(message) {
    console.error('Error: '.red + message);
}

function printWarning(message) {
    console.log('\nWarning: '.yellow + `${message}\n`);
}

function getGithubClient() {
    const github = new GitHub();

    github.authenticate({
        type: 'oauth',
        token: getGithubToken(),
    });

    return github;
}

function isReleaseCandidate(version) {
    return version.includes('-rc.');
}
