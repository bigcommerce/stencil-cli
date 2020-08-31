'use strict';

const Fs = require('fs');
const Path = require('path');
const { promisify } = require('util');
const async = require('async');

const StencilBundle = require('./stencil-bundle');
const LangAssembler = require('./lang-assembler');

const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const themeSchema = Fs.readFileSync((Path.join(themePath, 'schema.json'))).toString();

describe('Stencil Bundle', () => {
    let Bundle;

    beforeEach(() => {
        const themeConfigStub = getThemeConfigStub();
        const rawConfig = {
            "name": "Cornerstone",
            "version": "1.1.0",
        };

        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(Fs, 'writeFile').mockImplementation((path, data, cb) => cb(null));

        Bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, {
            marketplace: false,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should initialize bundling', () => {
        jest.spyOn(async, 'series').mockImplementation((tasks, cb) => cb(new Error('error')));
        const throws = () => {
            Bundle.initBundle();
        };

        expect(throws).toThrow(Error);
        expect(async.series).toHaveBeenCalledTimes(1);
    });

    it('should assemble CSS files', async () => {
        jest.spyOn(async, 'map').mockImplementation((coll, iteratee, cb) => cb(null, ['this is dog']));

        const task = Bundle.getCssAssembleTask('scss');
        const result = await promisify(task.bind(Bundle))();

        expect(result).toEqual({'theme.scss': 'this is dog'});
    });

    it('should error on assemble CSS files', async () => {
        jest.spyOn(async, 'map').mockImplementation((coll, iteratee, cb) => cb(new Error('our_error1')));

        const task = Bundle.getCssAssembleTask('scss');

        await expect(
            promisify(task.bind(Bundle))(),
        ).rejects.toThrow('our_error1');
    });

    it('should assembleTemplates', async () => {
        const result = await promisify(Bundle.assembleTemplatesTask.bind(Bundle))();

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
        jest.spyOn(async, 'map').mockImplementation((coll, iteratee, cb) => cb(new Error('our_error2')));

        await expect(
            promisify(Bundle.assembleTemplatesTask.bind(Bundle))(),
        ).rejects.toThrow('our_error2');
    });

    it('should assemble the Schema', async () => {
        const result = await promisify(Bundle.assembleSchema.bind(Bundle))();

        expect(result).toEqual(themeSchema);
    });

    it('should assemble the Lang Files', async () => {
        jest.spyOn(LangAssembler, 'assemble').mockImplementation(cb => cb(null));

        await promisify(Bundle.assembleLangTask.bind(Bundle))();

        expect(LangAssembler.assemble).toHaveBeenCalledTimes(1);
    });

    it('should error on assembling the Lang Files', async () => {
        jest.spyOn(LangAssembler, 'assemble').mockImplementation(cb => cb(new Error('our_error3')));

        await expect(
            promisify(Bundle.assembleLangTask.bind(Bundle))(),
        ).rejects.toThrow('our_error3');

        expect(LangAssembler.assemble).toHaveBeenCalledTimes(1);
    });

    it('should generate a manifest of files.', async () => {
        const templates = await promisify(Bundle.assembleTemplatesTask.bind(Bundle))();
        const manifest = await promisify(Bundle.generateManifest.bind(Bundle))({ templates });

        expect(manifest.templates).toEqual(expect.arrayContaining(['components/a', 'components/b']));
    });

    it('should error while reading files to generate a manifest of files.', async () => {
        Bundle.templatesPath = 'invalid/path';

        await expect(
           promisify(Bundle.generateManifest.bind(Bundle))({}),
       ).rejects.toThrow('no such file or directory');

        expect(Fs.writeFile).toHaveBeenCalledTimes(0);
    });

    function getThemeConfigStub() {
        const rawConfig = {
            meta: {
                author_name: "Emilio Esteves",
                author_email: "Emilio@work.net",
                author_support_url: "http://emilio.net",
            },
        };

        return {
            configExists: jest.fn().mockReturnValue(true),
            getRawConfig: jest.fn().mockReturnValue(rawConfig),
            getSchema: jest.fn(cb => cb(null, themeSchema)),
        };
    }
});
