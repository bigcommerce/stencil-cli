// Since previously a broken css was produced which had no effect on the page (browsers are smart enough to ignore unprocessable css)
// we can just comment out that part of code

const fs = require('fs');
const BaseFixer = require('./BaseFixer');

class BaseRulesFixer extends BaseFixer {
    async run() {
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const processedFile = await this.processCss(scss, this.transform());

        return [{ filePath: this.filePath, data: processedFile.css }];
    }

    transform() {
        return {
            postcssPlugin: 'Transform Base Rules Issues into Comments',
            Rule(rule, { Comment }) {
                if (rule.parent.type === 'root' && rule.selector.startsWith('&--')) {
                    const comment = new Comment({ text: rule.toString() });
                    rule.replaceWith(comment);
                }
            },
        };
    }
}

module.exports = BaseRulesFixer;
