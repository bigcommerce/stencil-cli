const async = require('async');
const fs = require('fs');
const path = require('path');
const upath = require('upath');

const importRegex = /@import\s+?["'](.+?)["'];/g;

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
    const ret = {};
    const ext = `.${type}`;

    const cssFilesArr = Array.isArray(cssFiles) ? cssFiles : [cssFiles];

    const parseImports = (cssFileAlias, parseImportsCallback) => {
        const normalizedCssFileAlias = cssFileAlias.replace(/(\.scss)$/g, '');
        const typedCssFilePath = path.join(absolutePath, normalizedCssFileAlias + ext);
        const rawCssFilePath = path.join(absolutePath, normalizedCssFileAlias + '.css');
        const cssFileAliasDir = path.parse(normalizedCssFileAlias).dir;

        const fileParts = path.parse(typedCssFilePath);
        const underscoredFilePath = path.join(fileParts.dir, `_${fileParts.base}`);
        let filePath;

        if (fs.existsSync(typedCssFilePath)) {
            filePath = typedCssFilePath;
        } else if (fs.existsSync(underscoredFilePath)) {
            filePath = underscoredFilePath;
        } else if (ext === '.scss' && fs.existsSync(rawCssFilePath)) {
            filePath = rawCssFilePath;
        } else {
            // File doesn't exist, just return to skip it
            parseImportsCallback();
            return;
        }

        fs.readFile(filePath, { encoding: 'utf-8' }, (err, content) => {
            const matches = [];
            let match;
            let importCssFileAlias;

            if (!err) {
                // Ensure all import paths are Unix paths for prod compat.
                const cssFile = options.bundle
                    ? upath.toUnix(normalizedCssFileAlias + ext)
                    : normalizedCssFileAlias + ext;

                ret[cssFile] = content;
                match = importRegex.exec(content);

                while (match !== null) {
                    [, importCssFileAlias] = match;
                    if (cssFileAliasDir) {
                        importCssFileAlias = path.join(cssFileAliasDir, importCssFileAlias);
                    }

                    if (!ret[importCssFileAlias + ext]) {
                        matches.push(importCssFileAlias);
                    }

                    match = importRegex.exec(content);
                }
            }

            async.each(matches, parseImports, parseImportsCallback);
        });
    };

    async.map(
        cssFilesArr,
        (cssFile, mapCallback) => {
            const cssFileParts = path.parse(cssFile);
            const cssFileAlias = path.join(cssFileParts.dir, cssFileParts.name);

            parseImports(cssFileAlias, mapCallback);
        },
        (err) => {
            if (err) {
                callback(err);
                return;
            }

            callback(null, ret);
        },
    );
}

module.exports = {
    assemble,
};
