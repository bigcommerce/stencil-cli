// There can be the case, when you have a comma at the beginning or at the end of the selector, which now is not allowed.
// Previously it was just ignored, but now it will cause an error.

const fs = require('fs');
const BaseFixer = require('./BaseFixer');

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

module.exports = CommaRemovalFixer;
