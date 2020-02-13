const _ = require('lodash');
const Async = require('async');
const Fs = require('fs');
const Path = require('path');
const Upath = require('upath');
const importRegex = /@import\s+?["'](.+?)["'];/g;

module.exports.assemble = assemble;

/**
 * Parses all of the imports for SCSS files and returns a flat object with the file path as the key and
 * file content as the value.
 *
 * @param cssFiles
 * @param absolutePath
 * @param type - scss
 * @param options - options object
 * @param callback
 */
function assemble(cssFiles, absolutePath, type, options, callback) {
    var ret = {},
        ext = '.' + type;

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (! _.isArray(cssFiles)) {
        cssFiles = [cssFiles];
    }

    Async.map(cssFiles, function(cssFile, mapCallback) {
        var cssFileParts = Path.parse(cssFile),
            cssFileAlias = Path.join(cssFileParts.dir, cssFileParts.name);

        parseImports(cssFileAlias, mapCallback);
    }, function (err) {
        if (err) {
            return callback(err);
        }

        callback(null, ret);
    });

    function parseImports(cssFileAlias, callback) {
        cssFileAlias = cssFileAlias.replace(/(\.scss)$/g, '');
        var file = Path.join(absolutePath, cssFileAlias + ext),
            cssFileAliasDir = Path.parse(cssFileAlias).dir;

        Async.parallel({
            originalFileExists: function(callback) {
                Fs.exists(file, function(exists) {
                    callback(null, exists ? file : false);
                });
            },
            underscoredFileExists: function(callback) {
                var fileParts = Path.parse(file),
                    underscoredFile = Path.join(fileParts.dir, '_' + fileParts.base);

                Fs.exists(underscoredFile, function(exists) {
                    callback(null, exists ? underscoredFile : false);
                });
            },
        },
        function(err, results) {
            var file = false;

            if (results.originalFileExists) {
                file = results.originalFileExists;
            }

            if (results.underscoredFileExists) {
                file = results.underscoredFileExists;
            }

            // File doesn't exist, just return to skip it
            if (! file) {
                return callback();
            }

            Fs.readFile(file, {encoding: 'utf-8'}, function(err, content) {
                var matches = [],
                    match,
                    importCssFileAlias,
                    cssFile;

                if (! err) {

                    //Ensure all import paths are Unix paths for prod compat.
                    if (options.bundle) {
                        cssFile = Upath.toUnix(cssFileAlias + ext);
                    } else {
                        cssFile = cssFileAlias + ext;
                    }

                    ret[cssFile] = content;
                    match = importRegex.exec(content);

                    while (match !== null) {
                        importCssFileAlias = match[1];
                        if (cssFileAliasDir) {
                            importCssFileAlias = Path.join(cssFileAliasDir, importCssFileAlias);
                        }

                        if (! ret[importCssFileAlias + ext]) {
                            matches.push(importCssFileAlias);
                        }

                        match = importRegex.exec(content);
                    }
                }

                Async.each(matches, parseImports, callback);
            });
        });
    }
}
