const Code = require('code');
const Lab = require('lab');
const Path = require('path');
const Sinon = require('sinon');
const lab = exports.lab = Lab.script();
const validator = new (require('jsonschema').Validator)();
const ThemeConfig = require('../../../../lib/theme-config');
const GetVersions = require('./getVersions');
const responseSchema = require('../../../../test/_mocks/api/getVersions.schema');

lab.describe('GET /versions/{id} api endpoint', function() {
    var requestStub = {
        log: function () {},
    };
    var options = {
        themeEditorHost: 'http://localhost:8181',
    };

    var themeConfig = new ThemeConfig.getInstance();

    lab.it('should reply with the right schema and include the theme schema', function(done) {

        themeConfig.setThemePath(Path.join(process.cwd(), 'test/_mocks/themes/valid'));

        GetVersions(options, themeConfig)(requestStub, function(response) {

            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            // expect theme schema to be included
            Code.expect(response.data.editorSchema)
                .to.be.an.array();

            Code.expect(response.data.editorSchema[0])
                .to.be.an.object();

            Code.expect(response.data.editorSchema[1])
                .to.be.an.object();

            // Make sure the force_reload was added to the settings in templates/*
            Code.expect(response.data.editorSchema[1].settings[0].force_reload)
                .to.be.true();

            Code.expect(response.data.editorSchema[1].settings[1].force_reload)
                .to.be.true();

            Code.expect(response.data.editorSchema[1].settings[2].force_reload)
                .to.be.true();

            done();
        });
    });

    lab.it('should not include the theme schema in the response', function(done) {

        themeConfig.setThemePath(Path.join(process.cwd(), 'test/_mocks/themes/bare-bones'));

        Sinon.spy(requestStub, 'log');

        GetVersions(options, themeConfig)(requestStub, function(response) {

            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            // expect theme schema to be included
            Code.expect(response.data.editorSchema)
                .to.be.an.array();

            Code.expect(response.data.editorSchema)
                .to.be.empty();

            Code.expect(requestStub.log.calledOnce)
                .to.be.true();

            done();
        });
    });

    lab.it('should respond with an error if the schema file is malformed', function(done) {

        themeConfig.setThemePath(Path.join(process.cwd(), 'test/_mocks/themes/bad-schema'));

        GetVersions(options, themeConfig)(requestStub, function(response) {

            Code.expect(response.data)
                .to.be.undefined();

            Code.expect(response.errors[0].type)
                .to.equal('parse_error');

            Code.expect(response.errors)
                .to.be.an.array();

            return {
                code: function (code) {
                    Code.expect(code).to.be.equal(400);

                    done();
                },
            };
        });
    });
});
