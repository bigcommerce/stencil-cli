const fetchMockModule = require('fetch-mock-jest');
const path = require('path');

const StencilStart = require('./stencil-start');

afterAll(() => jest.restoreAllMocks());

describe('StencilStart unit tests', () => {
    const getBrowserSyncStub = () => ({
        watch: jest.fn(),
        init: jest.fn(),
    });
    const getFetchStub = () => fetchMockModule.sandbox();
    const getFsStub = () => ({
        existsSync: jest.fn(),
    });
    const getFsUtilsStub = () => ({
        parseJsonFile: jest.fn(),
        recursiveReadDir: jest.fn(),
    });
    const getCliCommonStub = () => ({
        checkNodeVersion: jest.fn(),
    });
    const getThemeConfigManagerStub = () => ({});
    const getBuildConfigMangerStub = () => ({});
    const getTemplateAssemblerStub = () => ({});
    const getCyclesDetectorConstructorStub = () => jest.fn();
    const getLoggerStub = () => ({
        log: jest.fn(),
        error: jest.fn(),
    });

    const createStencilStartInstance = ({
        browserSync,
        fetch,
        fs,
        fsUtils,
        cliCommon,
        themeConfigManager,
        buildConfigManger,
        templateAssembler,
        CyclesDetector,
        logger,
    } = {}) => {
        const passedArgs = {
            browserSync: browserSync || getBrowserSyncStub(),
            fetch: fetch || getFetchStub(),
            fs: fs || getFsStub(),
            fsUtils: fsUtils || getFsUtilsStub(),
            cliCommon: cliCommon || getCliCommonStub(),
            themeConfigManager: themeConfigManager || getThemeConfigManagerStub(),
            buildConfigManger: buildConfigManger || getBuildConfigMangerStub(),
            templateAssembler: templateAssembler || getTemplateAssemblerStub(),
            CyclesDetector: CyclesDetector || getCyclesDetectorConstructorStub(),
            logger: logger || getLoggerStub(),
        };
        const instance = new StencilStart(passedArgs);

        return {
            passedArgs,
            instance,
        };
    };

    describe('constructor', () => {
        it('should create an instance of StencilStart without options parameters passed', async () => {
            const instance = new StencilStart();

            expect(instance).toBeInstanceOf(StencilStart);
        });

        it('should create an instance of StencilStart with all options parameters passed', async () => {
            const { instance } = createStencilStartInstance();

            expect(instance).toBeInstanceOf(StencilStart);
        });
    });

    describe('assembleTemplates method', () => {
        it('should obtain names of all templates in the passed templatesPath and return results of call templateAssembler.assemble for each template name', async () => {
            const templatesPath = '/some/absolute/templates/path';
            const templateNamesMock = ['layout/base', 'pages/page1'];
            const filesPathsMock = [
                templatesPath + path.sep + templateNamesMock[0] + '.html',
                templatesPath + path.sep + templateNamesMock[1] + '.html',
            ];
            const templateAssemblerResults = [
                {
                    [templateNamesMock[0]]: 'html file content 1',
                },
                {
                    [templateNamesMock[0]]: 'html file content 1',
                    [templateNamesMock[1]]: 'html file content 2',
                },
            ];
            const fsUtilsStub = {
                recursiveReadDir: jest.fn().mockResolvedValue(filesPathsMock),
            };
            const templateAssemblerStub = {
                assemble: jest
                    .fn()
                    .mockImplementationOnce((p, n, cb) => cb(null, templateAssemblerResults[0]))
                    .mockImplementationOnce((p, n, cb) => cb(null, templateAssemblerResults[1])),
            };

            const { instance } = createStencilStartInstance({
                fsUtils: fsUtilsStub,
                templateAssembler: templateAssemblerStub,
            });
            const result = await instance.assembleTemplates(templatesPath);

            expect(fsUtilsStub.recursiveReadDir).toHaveBeenCalledTimes(1);
            expect(fsUtilsStub.recursiveReadDir).toHaveBeenCalledWith(templatesPath, ['!*.html']);

            expect(templateAssemblerStub.assemble.mock.calls).toEqual([
                [templatesPath, templateNamesMock[0], expect.any(Function)],
                [templatesPath, templateNamesMock[1], expect.any(Function)],
            ]);

            expect(result).toStrictEqual(templateAssemblerResults);
        });
    });
});
