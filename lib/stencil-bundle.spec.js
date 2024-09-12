import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import async from 'async';
import StencilBundle from './stencil-bundle.js';
import LangAssembler from './lang-assembler.js';

const themePath = path.join(process.cwd(), 'test/_mocks/themes/valid');
const themeSchema = fs.readFileSync(path.join(themePath, 'schema.json')).toString();
function getThemeConfigStub() {
    const rawConfig = {
        meta: {
            author_name: 'Emilio Esteves',
            author_email: 'Emilio@work.net',
            author_support_url: 'http://emilio.net',
        },
    };
    return {
        configExists: jest.fn().mockReturnValue(true),
        getRawConfig: jest.fn().mockResolvedValue(rawConfig),
        getSchema: jest.fn().mockResolvedValue(themeSchema),
    };
}
describe('Stencil Bundle', () => {
    let bundle;
    beforeEach(() => {
        const themeConfigStub = getThemeConfigStub();
        const rawConfig = {
            name: 'Cornerstone',
            version: '1.1.0',
        };
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(fs, 'writeFile').mockImplementation((_path, _data, cb) => cb(null));
        bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, {
            marketplace: false,
        });
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('should assemble CSS files', async () => {
        jest.spyOn(async, 'map').mockImplementation((coll, iteratee, cb) =>
            cb(null, ['this is dog', 'this is not']),
        );
        const task = bundle.getCssAssembleTask('scss');
        const result = await promisify(task.bind(bundle))();
        expect(result).toEqual({
            'checkout.scss': 'this is dog',
            'theme.scss': 'this is not',
        });
    });
    it('should error on assemble CSS files', async () => {
        jest.spyOn(async, 'map').mockImplementation((coll, iteratee, cb) =>
            cb(new Error('our_error1')),
        );
        const task = bundle.getCssAssembleTask('scss');
        await expect(promisify(task.bind(bundle))()).rejects.toThrow('our_error1');
    });
    it('should assembleTemplates', async () => {
        const result = await bundle.assembleTemplatesTask.call(bundle);
        expect(result['pages/page']).toEqual(
            expect.objectContaining({
                'components/a': expect.any(String),
                'pages/page': expect.any(String),
            }),
        );
        expect(result['pages/page2']).toEqual(
            expect.objectContaining({
                'components/b': expect.any(String),
                'pages/page2': expect.any(String),
            }),
        );
    });
    it('should error when running assembleTemplates', async () => {
        const errorMessage = 'our_error2';
        const cb = (err) => {
            if (err) throw err;
        };
        jest.spyOn(async, 'map').mockImplementation(() => {
            throw new Error(errorMessage);
        });
        await expect(bundle.assembleTemplatesTask.call(bundle, cb)).rejects.toThrow(errorMessage);
    });
    it('should assemble the Schema', async () => {
        const result = await bundle.assembleSchema();
        expect(result).toEqual(themeSchema);
    });
    it('should assemble the Lang Files', async () => {
        jest.spyOn(LangAssembler, 'assemble').mockImplementation((cb) => cb(null));
        await promisify(bundle.assembleLangTask.bind(bundle))();
        expect(LangAssembler.assemble).toHaveBeenCalledTimes(1);
    });
    it('should error on assembling the Lang Files', async () => {
        jest.spyOn(LangAssembler, 'assemble').mockImplementation((cb) =>
            cb(new Error('our_error3')),
        );
        await expect(promisify(bundle.assembleLangTask.bind(bundle))()).rejects.toThrow(
            'our_error3',
        );
        expect(LangAssembler.assemble).toHaveBeenCalledTimes(1);
    });
    it('should generate a manifest of files.', async () => {
        const templates = await bundle.assembleTemplatesTask.call(bundle);
        const manifest = await promisify(bundle.generateManifest.bind(bundle))({ templates });
        expect(manifest.templates).toEqual(
            expect.arrayContaining(['components/a', 'components/b']),
        );
    });
    it('should error while reading files to generate a manifest of files.', async () => {
        bundle.templatesPath = 'invalid/path';
        await expect(promisify(bundle.generateManifest.bind(bundle))({})).rejects.toThrow(
            'no such file or directory',
        );
        expect(fs.writeFile).toHaveBeenCalledTimes(0);
    });
    it('should return array with external library names', async () => {
        const componentPathA = path.resolve(
            process.cwd(),
            'test/_mocks/themes/component-with-external-template/a.html',
        );
        const componentPathB = path.resolve(
            process.cwd(),
            'test/_mocks/themes/component-with-external-template/b.html',
        );
        const externalLib = 'theme-ui-components';
        const scopedExternalLib = '@bigcommerce/theme-ui-components';
        let mockLib;
        // eslint-disable-next-line no-underscore-dangle
        mockLib = await bundle._getExternalLibs(componentPathB);
        expect(mockLib).toContain(externalLib);
        // eslint-disable-next-line no-underscore-dangle
        mockLib = await bundle._getExternalLibs(componentPathA);
        expect(mockLib).toContain(scopedExternalLib);
    });
});
