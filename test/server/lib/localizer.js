'use strict';

var _ = require('lodash'),
    Code = require('code'),
    Localizer = require('../../server/lib/localizer'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    expect = Code.expect,
    it = lab.it;

lab.describe('Localizer', function () {
    var mockTranslations = {
        'en': 1,
        'en-CA': 2,
        'fr': 3,
        'fr-CA': 4
    };

    it('should successfully choose en locale file', function (done) {
        var acceptLanguage = 'en-US,en;q=0.8,en-CA;q=0.6',
            preferredTranslation = Localizer.getPreferredTranslation(acceptLanguage, mockTranslations);

        expect(preferredTranslation).to.equal(1);

        done();
    });

    it('should successfully choose fr locale file', function (done) {
        var acceptLanguage = 'en-US,fr;q=0.8,en-CA;q=0.6',
            preferredTranslation = Localizer.getPreferredTranslation(acceptLanguage, mockTranslations);

        expect(preferredTranslation).to.equal(3);

        done();
    });

    it('should successfully choose en-CA locale file', function (done) {
        var acceptLanguage = 'en-CA,en;q=0.6',
            preferredTranslation = Localizer.getPreferredTranslation(acceptLanguage, mockTranslations);

        expect(preferredTranslation).to.equal(2);

        done();
    });
});
