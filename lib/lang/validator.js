import 'colors';
import fs from 'fs';
import path from 'path';
import { recursiveReadDir } from '../utils/fsUtils.js';

const LANG_HELPER_REGEXP = /{{\s*lang\s*(?:'|")((?:\w*(?:-\w*)*(\.\w*(?:-\w*)*)*)+)/gim;
class LangpathsValidator {
    /**
     *
     * @param {String} themePath
     */
    constructor(themePath) {
        this.themePath = themePath;
    }

    async run(defaultLang = null) {
        const templatesPath = path.join(this.themePath, 'templates');
        const paths = await this.getLangHelpersPaths(templatesPath);
        const dedupePaths = [...new Set(paths)];
        const langFiles = await this.getLangFilesContent(defaultLang);
        const errors = this.validate(dedupePaths, langFiles);
        this.printErrors(errors);
        return errors;
    }

    printErrors(errors) {
        if (errors.length > 0) {
            console.log(
                'Warning: Your theme has some missing translations used in the theme:'.yellow,
            );
            console.log(errors.join('\n').yellow);
        }
    }

    searchLangPaths(fileContent, langPath) {
        const keys = langPath.split('.');
        let value = fileContent;
        for (const key of keys) {
            // eslint-disable-next-line no-prototype-builtins
            if (value && value.hasOwnProperty(key)) {
                value = value[key];
            } else {
                return false;
            }
        }
        return value;
    }

    validate(paths, langFiles) {
        const errors = [
            ...this.checkLangFiles(langFiles),
            ...this.checkForMissingTranslations(paths, langFiles),
        ];
        return errors;
    }

    checkForMissingTranslations(paths, langFiles) {
        const errors = [];
        for (const langPath of paths) {
            // eslint-disable-next-line no-restricted-syntax,guard-for-in
            for (const langFile in langFiles) {
                const translation = this.searchLangPaths(langFiles[langFile], langPath);
                if (!translation) {
                    errors.push(`Missing translation for ${langPath} in ${langFile}`);
                }
            }
        }
        return errors;
    }

    checkLangFiles(files) {
        if (files.length === 0) {
            return ['No lang files found in your theme'];
        }
        return [];
    }

    async getLangHelpersPaths(templatesPath) {
        const files = await recursiveReadDir(templatesPath);
        const paths = [];
        for await (const file of files) {
            const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
            const result = content.matchAll(LANG_HELPER_REGEXP);
            const arr = [...result];
            if (arr.length > 0) {
                const langPath = arr[0][1];
                paths.push(langPath);
            }
        }
        return paths;
    }

    async getLangFilesContent(defaultLang = null) {
        const filesContent = {};
        const langPath = path.join(this.themePath, 'lang');
        let files = await recursiveReadDir(langPath);
        if (defaultLang) {
            files = files.filter((file) => file.includes(defaultLang));
        }
        for await (const file of files) {
            const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
            filesContent[file] = JSON.parse(content);
        }
        return filesContent;
    }
}
export default LangpathsValidator;
