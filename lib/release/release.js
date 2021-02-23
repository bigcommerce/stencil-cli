const os = require('os');
const uuid = require('uuid4');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');

const ThemeConfig = require('../theme-config');
const askQuestions = require('./questions');
const Bundle = require('../stencil-bundle');
const StencilConfigManager = require('../StencilConfigManager');
const { parseJsonFile } = require('../utils/fsUtils');
const { THEME_PATH } = require('../../constants');

const git = simpleGit(THEME_PATH);
const themeConfigManager = ThemeConfig.getInstance(THEME_PATH);
const stencilConfigManager = new StencilConfigManager();

async function saveGithubToken(githubToken) {
    const data = (await stencilConfigManager.read(true)) || {};

    data.githubToken = githubToken;

    await stencilConfigManager.save(data);
}

async function getGithubToken() {
    const data = (await stencilConfigManager.read(true)) || {};

    return data.githubToken;
}

function isReleaseCandidate(version) {
    return version.includes('-rc.');
}

async function getGithubClient() {
    return new Octokit({
        auth: await getGithubToken(),
    });
}

async function createGithubRelease(commit, version, changelog, remote, bundlePath) {
    const github = await getGithubClient();

    const releaseParams = {
        owner: remote.owner,
        repo: remote.repo,
        tag_name: version,
        body: changelog || '',
        prerelease: isReleaseCandidate(version),
    };

    console.log('Creating Github Release...');

    const release = await github.repos.createRelease(releaseParams);
    const themeName = await themeConfigManager.getName();

    console.log('Uploading Bundle File...');

    const zipFile = await fs.promises.readFile(bundlePath);
    const uploadParams = {
        release_id: release.data.id,
        owner: remote.owner,
        repo: remote.repo,
        data: zipFile,
        name: `${themeName}-${version}.zip`,
    };
    const asset = await github.repos.uploadReleaseAsset(uploadParams);

    console.log(`Release url: ${release.data.html_url.green}`);
    console.log(`Bundle download url: ${asset.data.browser_download_url.green}`);
}

async function bumpJsonFileVersion(filePath, version) {
    const data = await parseJsonFile(filePath);

    data.version = version;
    await fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function parseChangelog(version, date) {
    const filePath = path.join(THEME_PATH, 'CHANGELOG.md');
    let changelog = '';

    try {
        changelog = await fs.promises.readFile(filePath, 'utf8');
    } catch (e) {
        // no CHANGELOG file
        return null;
    }

    const match = changelog.match(/##\s*?draft\s*?\n([\s\S]*?)(##|$)/i);

    // bump the version and date
    changelog = changelog.replace(/##\s*?draft\s*?\n/i, `## Draft\n\n## ${version} (${date})\n`);

    // Update the changelog file if this is a full release
    if (!isReleaseCandidate(version)) {
        await fs.promises.writeFile(filePath, changelog);
    }

    return match ? match[1].trim() : null;
}

async function bundleTheme() {
    const rawConfig = await themeConfigManager.getRawConfig();
    const bundleOptions = {
        dest: os.tmpdir(),
        name: uuid(),
    };
    const bundle = new Bundle(THEME_PATH, themeConfigManager, rawConfig, bundleOptions);

    return bundle.initBundle();
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
    await git.add(['config.json', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
    const summary = await git.commit(`Releasing ${version}`);

    console.log(`Pushing Changes to ${remote.name}...`);

    await git.push(remote.name, 'master');

    return summary.commit;
}

async function doRelease(options) {
    // Update changelog and get text for release notes
    const changelog = await parseChangelog(options.version, options.date);

    await bumpJsonFileVersion(themeConfigManager.configPath, options.version);
    await bumpJsonFileVersion(path.join(THEME_PATH, 'package.json'), options.version);
    await bumpJsonFileVersion(path.join(THEME_PATH, 'package-lock.json'), options.version);

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
        await fs.promises.unlink(bundlePath);
    }
}

async function run() {
    const gitData = await getGitData();

    if (!checkGitData(gitData)) {
        return;
    }

    try {
        const answers = await askQuestions(
            themeConfigManager,
            await getGithubToken(),
            gitData.remotes,
        );

        await saveGithubToken(answers.githubToken);

        await doRelease(answers);

        console.log('done'.green);
    } catch (err) {
        printError(err.message || err);
    }
}

module.exports = run;
