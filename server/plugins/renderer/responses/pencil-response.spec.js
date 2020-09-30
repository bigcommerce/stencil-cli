const PencilResponse = require('./pencil-response');

describe('PencilResponse', () => {
    const assembler = {
        getTemplates: (path) => new Promise((resolve) => resolve({ path })),
        getTranslations: () => new Promise((resolve) => resolve([])),
    };

    let data;
    let request;
    let response;
    let h;

    beforeEach(() => {
        data = {
            context: {
                settings: {},
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
});
