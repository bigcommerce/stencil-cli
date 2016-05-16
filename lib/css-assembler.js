var _ = require('lodash'),
    Async = require('async'),
    Fs = require('fs'),
    Path = require('path'),
    upath = require('upath'),
    importRegex = /@import\s+?["'](.+?)["'];/g,
    internals = {};


module.exports.assemble = assemble;

/**
 * Parses all of the imports for SCSS or LESS files and returns a flat object with the file path as the key and
 * file content as the value.
 *
 * @param cssFiles
 * @param absolutePath
 * @param type - scss or less
 * @param callback
 */
function assemble(cssFiles, absolutePath, type, callback) {
    var ret = {},
        ext = '.' + type;

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
            }
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
                    unixfiedFilename;

                if (! err) {
                    //Ensure all import paths are Unix paths for prod compat.
                    unixfiedFilename = upath.toUnix(cssFileAlias + ext);
                    ret[unixfiedFilename] = content;
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
