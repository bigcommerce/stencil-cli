import fs from 'fs';
import BaseFixer from './BaseFixer.js';

class CommaRemovalFixer extends BaseFixer {
    async run() {
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const processedFile = await this.processCss(scss, this.transform());
        return [{ filePath: this.filePath, data: processedFile.css }];
    }

    transform() {
        return {
            postcssPlugin: 'Unwanted comma removal',
            Rule(rule) {
                if (rule.selector.startsWith(',') || rule.selector.endsWith(',')) {
                    /* eslint-disable-next-line no-param-reassign */
                    rule.selector = rule.selector.trim().replace(/^,?|,?$/g, '');
                }
            },
        };
    }
}
export default CommaRemovalFixer;
