const os = require('os');
const uuid = require('uuid4');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const ThemeConfig = require('../theme-config');
const askQuestions = require('./questions');
const Bundle = require('../stencil-bundle');
const { parseJsonFile } = require('../utils/fsUtils');
const { THEME_PATH, DOT_STENCIL_FILE_PATH } = require('../../constants');

const git = simpleGit(THEME_PATH);
const themeConfig = ThemeConfig.getInstance(THEME_PATH);

function saveGithubToken(githubToken) {
    let data = {};

    if (fs.existsSync(DOT_STENCIL_FILE_PATH)) {
        data = parseJsonFile(DOT_STENCIL_FILE_PATH);
    }

    data.githubToken = githubToken;
    fs.writeFileSync(DOT_STENCIL_FILE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

function getGithubToken() {
    let data = {};

    if (fs.existsSync(DOT_STENCIL_FILE_PATH)) {
        data = parseJsonFile(DOT_STENCIL_FILE_PATH);
    }

    return data.githubToken;
}

function isReleaseCandidate(version) {
    return version.includes('-rc.');
}

function getGithubClient() {
    return new Octokit({
        auth: getGithubToken(),
    });
}

async function createGithubRelease(commit, version, changelog, remote, bundlePath) {
    const github = getGithubClient();

    const releaseParams = {
        owner: remote.owner,
        repo: remote.repo,
        tag_name: version,
        body: changelog || '',
        prerelease: isReleaseCandidate(version),
    };

    console.log('Creating Github Release...');

    const release = await github.repos.createRelease(releaseParams);

    const uploadParams = {
        release_id: release.data.id,
        owner: remote.owner,
        repo: remote.repo,
        data: bundlePath,
        name: `${themeConfig.getName()}-${version}.zip`,
    };

    console.log('Uploading Bundle File...');

    const asset = await github.repos.uploadReleaseAsset(uploadParams);

    console.log(`Release url: ${release.data.html_url.green}`);
    console.log(`Bundle download url: ${asset.data.browser_download_url.green}`);
}

function bumpJsonFileVersion(filePath, version) {
    const data = parseJsonFile(filePath);

    data.version = version;
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function parseChangelog(version, date) {
    const filePath = path.join(THEME_PATH, 'CHANGELOG.md');
    let changelog = '';

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

async function bundleTheme() {
    const bundle = new Bundle(THEME_PATH, themeConfig, themeConfig.getRawConfig(), {
        dest: os.tmpdir(),
        name: uuid(),
    });

    return util.promisify(bundle.initBundle.bind(bundle))();
}

async function getGitData() {
    const status = await git.status();

    const response = await git.getRemotes(true);

    const remotes = response.map((remote) => {
        const url = remote.refs.push || '';
        const match = url.match(/github\.com[/|:](.+?)\/(.+?)[/|.]/);

        return {
            name: remote.name,
            url,
            owner: match ? match[1] : null,
            repo: match ? match[2] : null,
        };
    });

    const dirty =
        status.not_added.length > 0 ||
        status.conflicted.length > 0 ||
        status.created.length > 0 ||
        status.deleted.length > 0 ||
        status.modified.length > 0 ||
        status.renamed.length > 0;

    return { dirty, ...status, remotes };
}

function printError(message) {
    console.error('Error: '.red + message);
}

function printWarning(message) {
    console.log('\nWarning: '.yellow + message);
}

/**
 * @param gitData
 * @param gitData.remotes
 * @param gitData.current
 * @param gitData.dirty
 * @param gitData.behind
 * @param gitData.ahead
 * @returns {boolean}
 */
function checkGitData(gitData) {
    if (gitData.remotes.length === 0) {
        printError('No git remote repository found');
        return false;
    }

    if (gitData.current !== 'master') {
        printError('Not on master branch, please checkout master branch to proceed');
        return false;
    }

    if (gitData.dirty) {
        printError('git tree is dirty, please commit changes to proceed');
        return false;
    }

    if (gitData.behind !== 0) {
        printError(`Your branch is behind by ${gitData.behind} commits`);
        return false;
    }

    if (gitData.ahead !== 0) {
        printWarning(`your branch is ahead by ${gitData.ahead} commits`);
    }

    return true;
}

async function commitAndPush(version, remote) {
    await git.add(['config.json', 'package.json', 'CHANGELOG.md']);
    const summary = await git.commit(`Releasing ${version}`);

    console.log(`Pushing Changes to ${remote.name}...`);

    await git.push(remote.name, 'master');

    return summary.commit;
}

async function doRelease(options) {
    // Update changelog and get text for release notes
    const changelog = parseChangelog(options.version, options.date);

    bumpJsonFileVersion(themeConfig.configPath, options.version);
    bumpJsonFileVersion(path.join(THEME_PATH, 'package.json'), options.version);

    const bundlePath = await bundleTheme();

    try {
        const commit = await commitAndPush(options.version, options.remote);

        if (options.createGithubRelease) {
            await createGithubRelease(
                commit,
                options.version,
                changelog,
                options.remote,
                bundlePath,
            );
        }
    } finally {
        fs.unlinkSync(bundlePath);
    }
}

async function run() {
    const gitData = await getGitData();

    if (!checkGitData(gitData)) {
        return;
    }

    try {
        const answers = await askQuestions(themeConfig, getGithubToken(), gitData.remotes);

        saveGithubToken(answers.githubToken);

        await doRelease(answers);

        console.log('done'.green);
    } catch (err) {
        printError(err.message || err);
    }
}

module.exports = run;
