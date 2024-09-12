import fs from 'fs';
import BaseFixer from './BaseFixer.js';

class UndefinedVariableFixer extends BaseFixer {
    async run(errorMessage) {
        const varName = this.getUndefinedVariableName(errorMessage);
        const value = await this.guessVariableValue(varName);
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const processedFile = await this.processCss(scss, this.transform(varName, value));
        return [{ filePath: this.filePath, data: processedFile.css }];
    }

    getUndefinedVariableName(errorMessage) {
        const match = errorMessage.match(/\$[a-zA-Z_-]+/gi);
        if (!match) {
            throw new Error("Couldn't detemine undefined variable name!");
        }
        return match[0];
    }

    transform(varName, value) {
        return {
            postcssPlugin: 'Declare unvariable variable value',
            Once(root, { Declaration }) {
                const newRule = new Declaration({
                    value,
                    prop: varName,
                    source: '',
                });
                root.prepend(newRule);
            },
        };
    }

    async guessVariableValue(varName) {
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const processedFile = await this.processCss(
            scss,
            this.transformForGuessingVariableValue(varName),
        );
        return processedFile.varValue;
    }

    transformForGuessingVariableValue(varName) {
        return {
            postcssPlugin: 'Get first variable value found in the file',
            Declaration: (decl, { result }) => {
                if (decl.prop === varName) {
                    // eslint-disable-next-line no-param-reassign
                    result.varValue = decl.value;
                    // todo propertly break on first found declaration
                }
            },
        };
    }
}
export default UndefinedVariableFixer;
