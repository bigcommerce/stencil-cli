'use strict';

const Jspm = require('jspm');
const Fs = require('fs');
const Path = require('path');

/**
 * Initiates the JSPM compilation piece
 * @param jspmOptions
 * @param themePath
 * @returns {Function}
 */
function assemble(jspmOptions, themePath) {
    return callback => {
        const oldConsoleError = console.error;
        const jspmDepLocation = jspmOptions.dev && jspmOptions.dev.dep_location
            ? jspmOptions.dev.dep_location
            : 'assets/js/dependency-bundle.js';

        console.log('Bundling dependencies for faster development... ' + jspmDepLocation.cyan);

        // Need to suppress annoying errors from Babel.
        // They will be gone in the next minor version of JSPM (0.16.0).
        // Until then, this will stay in place
        console.error = error => {
            if (!/Deprecated option metadataUsedHelpers/.test(error)) {
                oldConsoleError(error);
            }
        };

        // Delete old dependency file if it exists
        deleteIfExist(Path.join(themePath, jspmDepLocation));
        deleteIfExist(Path.join(themePath, jspmOptions.bundle_location));

        Jspm.setPackagePath(themePath);
        Jspm.bundle(jspmOptions.dev.bootstrap, jspmDepLocation, {minify: true, sourceMaps: true}).then(() => {
            console.log('ok'.green + ' -- JavaScript Bundling Finished');
            console.error = oldConsoleError;
            callback(null, true);
        });
    };
}

function deleteIfExist(path) {
    if (Fs.existsSync(path)) {
        Fs.unlinkSync(path);
    }
}

module.exports.assemble = assemble;
