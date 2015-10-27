var Code = require('code');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');
var Sinon = require('sinon');
var Proxyquire = require('proxyquire').noCallThru();
var lab = exports.lab = Lab.script();
var Validator = require('jsonschema').Validator;
var modulePath = '../../../../../server/plugins/StencilEditor/api/versions';

var responseSchema = {
    "data": {
        "id": "string",
        "name": "string",
        "price": 0,
        "displayVersion": "string",
        "editorSchema": [
            {}
        ],
        "status": "string",
        "numVariations": 0,
        "defaultVariationId": "string",
        "screenshot": "string"
    },
    "meta": {}
}

lab.describe('GET /versions/{id} api endpoint', function() {
    var readFileStub;
    var options = {
        themeConfigSchemaPath: '/path/schema.json',
        themeEditorHost: 'http://localhost:3000',
        themeTemplatesPath: '/path/templates'
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

    var themeSchema = [
        {
            "name": "Colors",
            "settings": [
                {
                    "type": "color",
                    "label": "Text Color",
                    "id": "body-font-color"
                },
                {
                    "type": "color",
                    "label": "Link Color",
                    "id": "color-textLink"
                }
            ]
        },
        {
            "name": "Page",
            "settings": [
                {
                    // attribute that requires force_reload
                    "type": "color",
                    "label": "Background Color",
                    "id": "footer-backgroundColor"
                },
                {
                    "type": "color",
                    "label": "Column Header Text",
                    "id": "footer-heading-fontColor"
                }
            ]
        }
    ];

    var glob = function(pattern, callback) {
        callback(null, ['file1', 'file2']);
    };

    lab.beforeEach(function(done) {        
        readFileStub = Sinon.stub(Fs, 'readFile');
        readFileStub.yields(null, '{{theme_settings.footer-backgroundColor}}')

        done();
    });

    lab.afterEach(function(done) {
        readFileStub.restore();

        done();
    });

    lab.it('should reply with the correct schema and include the theme schema', function(done) {

        var Versions = Proxyquire(modulePath, {
            '/path/schema.json': themeSchema,
            'glob': glob
        });

        Versions(options, themeConfig)({}, function(response) {
            var v = new Validator();

            // Validate the response schema against the theme-registry schema
            Code.expect(v.validate(response, responseSchema).errors)
                .to.be.empty();

            // expect theme schema to be included
            Code.expect(response.data.editorSchema)
                .to.deep.equal(themeSchema);

            // Make sure the force_reload was added to footer-backgroundColor
            Code.expect(response.data.editorSchema[1].settings[0].force_reload)
                .to.be.true();

            done();
        });
    });
});
