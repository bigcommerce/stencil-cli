const os = require('os');
const uuid = require('uuid4');
const fsModule = require('fs');
const path = require('path');
const octokitModule = require('@octokit/rest');
const simpleGit = require('simple-git');

const ThemeConfig = require('../theme-config');
const askQuestions = require('./questions');
const Bundle = require('../stencil-bundle');
const StencilConfigManager = require('../StencilConfigManager');
const fsUtilsModule = require('../utils/fsUtils');
const { THEME_PATH } = require('../../constants');

class StencilRelease {
    constructor({
        git = simpleGit(THEME_PATH),
        themeConfigManager = ThemeConfig.getInstance(THEME_PATH),
        stencilConfigManager = new StencilConfigManager(),
        fs = fsModule,
        fsUtils = fsUtilsModule,
        logger = console,
        octokit = octokitModule,
    } = {}) {
        this._git = git;
        this._themeConfigManager = themeConfigManager;
        this._stencilConfigManager = stencilConfigManager;
        this._fs = fs;
        this._fsUtils = fsUtils;
        this._logger = logger;
        this._octokit = octokit;
    }

    async run() {
        const gitData = await this.getGitData();
        this.checkGitData(gitData);

        const version = await this._themeConfigManager.getVersion();
        this.checkCurrentVersion(version);

        const answers = await askQuestions(version, await this.getGithubToken(), gitData.remotes);

        await this.saveGithubToken(answers.githubToken);

        await this.doRelease(answers);

        this._logger.log('done'.green);

        return true;
    }

    async getGitData() {
        const status = await this._git.status();

        const response = await this._git.getRemotes(true);

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

    /**
     * @param gitData
     * @param gitData.remotes
     * @param gitData.current
     * @param gitData.dirty
     * @param gitData.behind
     * @param gitData.ahead
     * @returns {boolean}
     */
    checkGitData(gitData) {
        if (gitData.remotes.length === 0) {
            throw new Error('No git remote repository found');
        }

        if (gitData.current !== 'master') {
            throw new Error('Not on master branch, please checkout master branch to proceed');
        }

        if (gitData.dirty) {
            throw new Error('git tree is dirty, please commit changes to proceed');
        }

        if (gitData.behind !== 0) {
            throw new Error(`Your branch is behind by ${gitData.behind} commits`);
        }

        if (gitData.ahead !== 0) {
            this.printWarning(`your branch is ahead by ${gitData.ahead} commits`);
        }
    }

    checkCurrentVersion(version) {
        if (!version) {
            throw new Error('You should specify theme version in config.json');
        }
    }

    printWarning(message) {
        this._logger.log('\nWarning: '.yellow + message);
    }

    async getGithubToken() {
        const data = (await this._stencilConfigManager.read(true)) || {};

        return data.githubToken;
    }

    async saveGithubToken(githubToken) {
        const data = (await this._stencilConfigManager.read(true)) || {};

        data.githubToken = githubToken;

        await this._stencilConfigManager.save(data);
    }

    async doRelease(options) {
        // Update changelog and get text for release notes
        const changelog = await this.parseChangelog(options.version, options.date);

        await this.bumpJsonFileVersion(this._themeConfigManager.configPath, options.version);
        await this.bumpJsonFileVersion(path.join(THEME_PATH, 'package.json'), options.version);
        await this.bumpJsonFileVersion(path.join(THEME_PATH, 'package-lock.json'), options.version);

        const bundlePath = await this.bundleTheme();

        try {
            await this.commitAndPush(options.version, options.remote);

            if (options.createGithubRelease) {
                await this.createGithubRelease(
                    options.version,
                    changelog,
                    options.remote,
                    bundlePath,
                );
            }
        } finally {
            await this._fs.promises.unlink(bundlePath);
        }
    }

    async parseChangelog(version, date) {
        const filePath = path.join(THEME_PATH, 'CHANGELOG.md');
        let changelog = '';

        try {
            changelog = await this._fs.promises.readFile(filePath, 'utf8');
        } catch (e) {
            // no CHANGELOG file
            return null;
        }

        const match = changelog.match(/##\s*?draft\s*?\n([\s\S]*?)(##|$)/i);

        // bump the version and date
        changelog = changelog.replace(
            /##\s*?draft\s*?\n/i,
            `## Draft\n\n## ${version} (${date})\n`,
        );

        // Update the changelog file if this is a full release
        if (!this.isReleaseCandidate(version)) {
            await this._fs.promises.writeFile(filePath, changelog);
        }

        return match ? match[1].trim() : null;
    }

    isReleaseCandidate(version) {
        return version.includes('-rc.');
    }

    async bumpJsonFileVersion(filePath, version) {
        const data = await this._fsUtils.parseJsonFile(filePath);

        data.version = version;
        await this._fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
    }

    async bundleTheme() {
        const rawConfig = await this._themeConfigManager.getRawConfig();
        const bundleOptions = {
            dest: os.tmpdir(),
            name: uuid(),
        };
        const bundle = new Bundle(THEME_PATH, this._themeConfigManager, rawConfig, bundleOptions);

        return bundle.initBundle();
    }

    async commitAndPush(version, remote) {
        await this._git.add(['config.json', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
        const summary = await this._git.commit(`Releasing ${version}`);

        this._logger.log(`Pushing Changes to ${remote.name}...`);

        await this._git.push(remote.name, 'master');

        return summary.commit;
    }

    async createGithubRelease(version, changelog, remote, bundlePath) {
        const github = await this.getGithubClient();

        const releaseParams = {
            owner: remote.owner,
            repo: remote.repo,
            tag_name: version,
            body: changelog || '',
            prerelease: this.isReleaseCandidate(version),
        };

        this._logger.log('Creating Github Release...');

        const release = await github.repos.createRelease(releaseParams);
        const themeName = await this._themeConfigManager.getName();

        this._logger.log('Uploading Bundle File...');

        const zipFile = await this._fs.promises.readFile(bundlePath);
        const uploadParams = {
            release_id: release.data.id,
            owner: remote.owner,
            repo: remote.repo,
            data: zipFile,
            name: `${themeName}-${version}.zip`,
        };
        const asset = await github.repos.uploadReleaseAsset(uploadParams);

        this._logger.log(`Release url: ${release.data.html_url.green}`);
        this._logger.log(`Bundle download url: ${asset.data.browser_download_url.green}`);
    }

    async getGithubClient() {
        return new this._octokit.Octokit({
            auth: await this.getGithubToken(),
        });
    }
}

module.exports = StencilRelease;
