const inquirerModule = require('inquirer');

const StencilRelease = require('./release');
const StencilBundle = require('../stencil-bundle');

afterAll(() => jest.restoreAllMocks());

describe('Release unit tests', () => {
    let accessToken;
    let normalStoreUrl;
    let stencilConfig;
    let remoteUrl;
    let gitStatus;
    let remotes;
    let commit;
    let currentThemeVersion;
    let newThemeVersion;
    let fileData;
    let changelog;
    let rawConfig;
    let bundlePath;
    let themeName;
    let uploadReleaseAssetData;
    let releaseData;
    let answers;
    let githubToken;
    beforeEach(() => {
        accessToken = 'accessToken_value';
        normalStoreUrl = 'https://www.example.com';
        stencilConfig = {
            accessToken,
            normalStoreUrl,
        };
        remoteUrl = 'https://github.com/bigcommerce/cornerstone';
        githubToken = 'githubToken_value';
        gitStatus = {
            not_added: [],
            conflicted: [],
            created: [],
            deleted: [],
            modified: [],
            renamed: [],
            current: 'master',
            behind: 0,
            ahead: 0,
        };
        remotes = [{ refs: { push: remoteUrl }, name: 'cornerstone' }];
        commit = {
            commit: '12345789',
        };
        currentThemeVersion = '1.0.0';
        newThemeVersion = '1.0.1';
        fileData = {
            version: newThemeVersion,
        };
        changelog = `
# Changelog
All notable changes to this project will be documented in this file.


## Draft

## 1.0.0 (08-06-2021)
- Released 1.0.0
`;
        rawConfig = {
            meta: {
                author_name: 'Emilio Esteves',
                author_email: 'Emilio@work.net',
                author_support_url: 'http://emilio.net',
            },
        };
        bundlePath = 'somePath';
        themeName = 'cornerstone';
        uploadReleaseAssetData = {
            data: {
                browser_download_url: 'bundle_download_url',
            },
        };
        releaseData = {
            data: {
                id: 'release_id',
                html_url: 'release_url',
            },
        };
        answers = {
            version: newThemeVersion,
            remote: remoteUrl,
            createGithubRelease: true,
            githubToken,
            proceed: true,
        };

        jest.spyOn(inquirerModule, 'prompt').mockReturnValue(answers);
        jest.spyOn(StencilBundle.prototype, 'initBundle').mockReturnValue(bundlePath);
    });

    const getFsUtilsStub = () => ({
        existsSync: jest.fn(),
        parseJsonFile: jest.fn().mockResolvedValue(fileData),
        recursiveReadDir: jest.fn(),
    });
    const getCliCommonStub = () => ({
        checkNodeVersion: jest.fn(),
    });
    const getThemeConfigManagerStub = () => ({
        getVersion: jest.fn().mockResolvedValue(currentThemeVersion),
        getRawConfig: jest.fn().mockResolvedValue(rawConfig),
        configExists: jest.fn().mockReturnValue(true),
        schemaExists: jest.fn().mockReturnValue(false),
        getName: jest.fn().mockResolvedValue(themeName),
    });
    const getStencilConfigManagerStub = () => ({
        read: jest.fn().mockResolvedValue(stencilConfig),
        save: jest.fn(),
    });

    const getGitStub = () => ({
        status: jest.fn().mockResolvedValue(gitStatus),
        getRemotes: jest.fn().mockResolvedValue(remotes),
        add: jest.fn(),
        commit: jest.fn().mockResolvedValue(commit),
        push: jest.fn(),
    });
    const getFsModuleStub = () => ({
        promises: {
            unlink: jest.fn(),
            readFile: jest.fn().mockReturnValueOnce(changelog),
            writeFile: jest.fn(),
        },
    });

    const getLoggerStub = () => ({
        log: jest.fn(),
        error: jest.fn(),
        warning: jest.fn(),
    });

    const getOctokitStub = () => ({
        Octokit: jest.fn().mockImplementation(() => ({
            repos: {
                uploadReleaseAsset: jest.fn().mockResolvedValue(uploadReleaseAssetData),
                createRelease: jest.fn().mockResolvedValue(releaseData),
            },
        })),
    });

    const createStencilReleaseInstance = (passedArgs) => {
        const defaultMocks = {
            git: getGitStub(),
            themeConfigManager: getThemeConfigManagerStub(),
            stencilConfigManager: getStencilConfigManagerStub(),
            fs: getFsModuleStub(),
            fsUtils: getFsUtilsStub(),
            cliCommon: getCliCommonStub(),
            logger: getLoggerStub(),
            octokit: getOctokitStub(),
        };
        return new StencilRelease({ ...defaultMocks, ...passedArgs });
    };

    describe('constructor', () => {
        it('should create an instance of StencilRelease without options parameters passed', async () => {
            const instance = new StencilRelease();

            expect(instance).toBeInstanceOf(StencilRelease);
        });

        it('should create an instance of StencilRelease with all options parameters passed', async () => {
            const instance = createStencilReleaseInstance();

            expect(instance).toBeInstanceOf(StencilRelease);
        });
    });

    describe('run', () => {
        it('should run stencil release successfully', async () => {
            const instance = createStencilReleaseInstance();

            const result = await instance.run();

            expect(result).toBe(true);
        });
    });
});
