const Code = require('code');
const Lab = require('@hapi/lab');
const sinon = require('sinon');

const PencilResponse = require('./pencil-response');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const it = lab.it;


lab.describe('PencilResponse', () => {
    const assembler = {
        getTemplates: path => new Promise(resolve => resolve({ path })),
        getTranslations: () => new Promise(resolve => resolve([])),
    };

    let data;
    let request;
    let response;
    let h;


    lab.beforeEach(() => {
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
            app: {themeConfig: {variationIndex: 1}},
            headers: {},
            query: {},
        };

        response = {
            code: () => response,
        };

        h = {
            response: sinon.stub().returns(response),
        };

    });

    it('should return error, when the wrong template_engine is sent', () => {
        data.context.template_engine = "handlebars";
        const pencilResponse = new PencilResponse(data, assembler);
        expect(
            () => pencilResponse.respond(request, h),
        ).to.throw(Error, 'Provided Handlebars version is not supported! Please use:handlebars-v3, handlebars-v4');
    });

    it('should render successfully with supported template_engine', async () => {
        const pencilResponse = new PencilResponse(data, assembler);
        await pencilResponse.respond(request, h);
        console.log(h.response.called);
        expect(h.response.called).to.be.true();
    });

    it('should default to handlebars_v3 when the template_engine doesn\'t exist', async () => {
        delete data.context.template_engine;
        console.log(data.context);
        const pencilResponse = new PencilResponse(data, assembler);
        await pencilResponse.respond(request, h);
        console.log(h.response.called);
        expect(h.response.called).to.be.true();
    });
});
