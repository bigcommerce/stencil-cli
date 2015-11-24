'use strict';
var Async = require('async'),
    Jspm = require('jspm'),
    Fs = require('fs'),
    Path = require('path'),
    _ = require('lodash');

/**
 * Initiates the JSPM compilation piece
 * @param jspmOptions
 * @param themePath
 * @returns {Function}
 */
function assemble(jspmOptions, themePath) {
    return function(callback) {
        var oldConsoleError = console.error,
            jspmDepLocation,
            depLocation;

        // Look for development configuration
        if (jspmOptions.dep_location) {
            jspmDepLocation = jspmOptions.dep_location;
        } else {
            jspmDepLocation = 'assets/js/dependency-bundle.js';
        }

        depLocation = Path.join(themePath, jspmDepLocation);

        console.log('JavaScript Bundling Started...');

        // Need to suppress annoying errors from Babel.
        // They will be gone in the next minor version of JSPM (0.16.0).
        // Until then, this will stay in place
        console.error = function (error) {
            if (!/Deprecated option metadataUsedHelpers/.test(error)) {
                oldConsoleError(error);
            }
        };

        // Delete old dependency file if it exists
        if (Fs.existsSync(depLocation)) {
            Fs.unlinkSync(depLocation);
        }

        Jspm.setPackagePath(themePath);
        Jspm.bundle(jspmOptions.bootstrap, jspmDepLocation, {minify: true, sourceMaps: true}).then(function () {
            console.log('ok'.green + ' -- JavaScript Bundling Finished');
            console.error = oldConsoleError;
            callback(null, true);
        });
    };
}

module.exports.assemble = assemble;
