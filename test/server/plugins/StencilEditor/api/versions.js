var Code = require('code');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');
var Sinon = require('sinon');
var Proxyquire = require('proxyquire').noCallThru();
var lab = exports.lab = Lab.script();
var validator = new (require('jsonschema').Validator)();
var VersionsApi = require('../../../../../server/plugins/StencilEditor/api/versions');
var responseSchema = require('./versions.schema');

lab.describe('GET /versions/{id} api endpoint', function() {
    var requestStub = {
        log: function () {}
    };
    var themeConfig = {
        getConfig: function() {
            return {
                name: 'Stencil',
                meta: {
                    price: 15000,
                    composed_image: "image.png"
                },
                version: "1.0.0",
                variations: [{}, {}, {}]
            }
        }
    };

    lab.it('should reply with the right schema and include the theme schema', function(done) {

        var options = {
            themeSchemaPath: Path.join(process.cwd(), 'test/_mocks/schema.json'),
            themeEditorHost: 'http://localhost:3000',
            themeTemplatesPath: Path.join(process.cwd(), '/test/_mocks/templates')
        };

        VersionsApi(options, themeConfig)(requestStub, function(response) {

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

            // Make sure the force_reload was added to the settings in _mocks/templates/*
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
        var options = {
            themeSchemaPath: Path.join(process.cwd(), 'test/_mocks/schemaNotExistant.json'),
            themeEditorHost: 'http://localhost:3000',
            themeTemplatesPath: Path.join(process.cwd(), '/test/_mocks/templates')
        };

        Sinon.spy(requestStub, 'log');

        VersionsApi(options, themeConfig)(requestStub, function(response) {

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

        var options = {
            themeSchemaPath: Path.join(process.cwd(), 'test/_mocks/malformedSchema.json'),
            themeEditorHost: 'http://localhost:3000',
            themeTemplatesPath: Path.join(process.cwd(), '/test/_mocks/templates')
        };

        VersionsApi(options, themeConfig)(requestStub, function(response) {

            Code.expect(response.data)
                .to.be.undefined();

            Code.expect(response.errors[0].type)
                .to.equal('parse_error');

            Code.expect(response.errors)
                .to.be.an.array();

            done();
        });
    });
});
