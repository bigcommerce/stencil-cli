import { jest } from '@jest/globals';
import path from 'path';
import { promisify } from 'util';
import PencilResponse from './pencil-response.js';
import templateAssembler from '../../../../lib/template-assembler.js';

describe('PencilResponse', () => {
    const assembler = {
        getTemplates: (p) =>
            new Promise((resolve) => {
                resolve({ path: p });
            }),
        getTranslations: () =>
            new Promise((resolve) => {
                resolve([]);
            }),
    };
    let data;
    let request;
    let response;
    let h;
    beforeEach(() => {
        data = {
            context: {
                settings: {
                    base_url: 'http://localhost:3000',
                    secure_base_url: 'https://localhost:3000',
                },
                theme_settings: {},
                template_engine: 'handlebars-v3',
            },
            headers: {},
            template_file: null,
            remote: true,
            remote_data: '',
        };
        request = {
            url: {},
            path: '/',
            app: { themeConfig: { variationIndex: 1 } },
            headers: {},
            query: {},
        };
        response = {
            code: () => response,
        };
        h = {
            response: jest.fn().mockReturnValue(response),
        };
    });
    it('should return error, when the wrong template_engine is sent', async () => {
        data.context.template_engine = 'handlebars';
        const pencilResponse = new PencilResponse(data, assembler);
        await expect(() => pencilResponse.respond(request, h)).rejects.toThrow(
            'Provided Handlebars version is not supported! Please use:handlebars-v3, handlebars-v4',
        );
    });
    it('should render successfully with supported template_engine', async () => {
        const pencilResponse = new PencilResponse(data, assembler);
        await pencilResponse.respond(request, h);
        expect(h.response).toHaveBeenCalledTimes(1);
    });
    it("should default to handlebars-v3 when the template_engine doesn't exist", async () => {
        delete data.context.template_engine;
        const pencilResponse = new PencilResponse(data, assembler);
        await pencilResponse.respond(request, h);
        expect(h.response).toHaveBeenCalledTimes(1);
    });
    it('should make compatible handlbers_v3 variable', async () => {
        data.context.template_engine = 'handlebars_v3';
        const pencilResponse = new PencilResponse(data, assembler);
        await pencilResponse.respond(request, h);
        expect(h.response).toHaveBeenCalledTimes(1);
    });

    describe('it should successfully render a tempalte with dynamic partials', () => {
        it('should render a template with dynamic partials', async () => {
            let result = '';
            data.template_file = 'pages/page3';
            data.context.template_engine = 'handlebars-v4';

            h.response = (output) => {
                result = output;
                return response;
            };
            const themeAssembler = {
                async getTemplates(templatesPath, processor) {
                    const templates = await promisify(templateAssembler.assemble)(
                        path.join(process.cwd(), 'test/_mocks/themes/valid', 'templates'),
                        templatesPath,
                    );
                    return processor(templates);
                },
                getTranslations: async () => {
                    return {};
                },
            };
            const pencilResponse = new PencilResponse(data, themeAssembler);
            await pencilResponse.respond(request, h);
            expect(result.content).toEqual(`<!DOCTYPE html>
<html>
<head>
    <title>page3.html</title>
    
</head>
<body>
    <h1></h1>
    Here is the list:
<ul>
        <li>
    <a href="item_link_1">Item 1</a>
</li>    <li>
    <a href="item_link_2">Item 2</a>
</li>    <li>
    <a href="item_link_3">Item 3</a>
</li><ul></body>
</html>`);
        });
    });
});
