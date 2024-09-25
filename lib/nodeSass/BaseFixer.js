import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';

class BaseFixer {
    constructor(dirname, brokenFile) {
        this.filePath = this.resolveScssFileName(dirname, brokenFile);
    }

    async processCss(data, plugin) {
        const processor = postcss([plugin]);
        return processor.process(data, { from: undefined, parser: postcssScss });
    }

    findImportedFile(file, originalFilePath) {
        const originalDirname = path.dirname(originalFilePath);
        return this.resolveScssFileName(originalDirname, file);
    }

    resolveScssFileName(dirname, fileName) {
        if (!fileName.includes('.scss')) {
            /* eslint-disable-next-line no-param-reassign */
            fileName += '.scss';
        }
        const filePath = path.join(dirname, fileName);
        if (!fs.existsSync(filePath)) {
            // try with underscore
            const fileNameWithUnderscore = this.getFileNameWithUnderscore(fileName);
            const filePathWithUnderscore = path.join(dirname, fileNameWithUnderscore);
            if (!fs.existsSync(filePathWithUnderscore)) {
                throw new Error(
                    `Import ${fileName} wasn't resolved in ${filePath} or ${filePathWithUnderscore}`,
                );
            }
            return filePathWithUnderscore;
        }
        return filePath;
    }

    getFileNameWithUnderscore(fileName) {
        const fileNameParts = fileName.split('/');
        const fileNameWithUnderscore = fileNameParts
            .map((part, i) => {
                if (i === fileNameParts.length - 1) {
                    return '_' + part;
                }
                return part;
            })
            .join('/');
        return fileNameWithUnderscore;
    }
}
export default BaseFixer;
