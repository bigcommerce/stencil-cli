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
        const self = this;
        return {
            postcssPlugin: 'Transform Base Rules Issues into Comments',
            Rule(rule, { Comment }) {
                if (
                    rule.parent.type === 'root' &&
                    (rule.selector.startsWith('&') ||
                        rule.selector.startsWith(':not(&)') ||
                        rule.selector.startsWith('* &'))
                ) {
                    const comment = new Comment({ text: self.replaceInnerComments(rule) });
                    rule.replaceWith(comment);
                }
            },
        };
    }

    // when we replace rule with comment, there might be a case when comment is inside another rule
    // which breaks the commenting root rule
    replaceInnerComments(rule) {
        return rule.toString().replace(/\/\*(.*)\*\//g, '//$1');
    }
}

module.exports = BaseRulesFixer;
