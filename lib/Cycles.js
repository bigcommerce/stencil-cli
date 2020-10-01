const Graph = require('tarjan-graph');
const util = require('util');

class Cycles {
    /**
     * @param {object[]} templatePaths
     */
    constructor(templatePaths) {
        if (!Array.isArray(templatePaths)) {
            throw new Error('templatePaths must be an Array');
        }

        this.templatePaths = templatePaths;
        this.partialRegex = /{{>\s*([_|\-|a-zA-Z0-9/]+)[^{]*?}}/g;
        this.dynamicComponentRegex = /{{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9/]+)(?:'|").*?}}/g;
    }

    /**
     * Runs a graph based cyclical dependency check. Throws an error if circular dependencies are found
     * @returns {void}
     */
    detect() {
        for (const templatesByPath of this.templatePaths) {
            const graph = new Graph();

            for (const [templatePath, templateContent] of Object.entries(templatesByPath)) {
                const dependencies = [
                    ...this._geDependantPartials(templateContent, templatePath),
                    ...this._getDependantDynamicComponents(
                        templateContent,
                        templatesByPath,
                        templatePath,
                    ),
                ];

                graph.add(templatePath, dependencies);
            }

            if (graph.hasCycle()) {
                const foundCycles = util.inspect(graph.getCycles());
                throw new Error(`Circular dependency in template detected. \r\n${foundCycles}`);
            }
        }
    }

    /**
     * @private
     * @param {string} templateContent
     * @param {string} pathToSkip
     * @returns {string[]}
     */
    _geDependantPartials(templateContent, pathToSkip) {
        const dependencies = [];

        let match = this.partialRegex.exec(templateContent);
        while (match !== null) {
            const partialPath = match[1];
            // skip the current templatePath
            if (partialPath !== pathToSkip) {
                dependencies.push(partialPath);
            }
            match = this.partialRegex.exec(templateContent);
        }

        return dependencies;
    }

    /**
     * @private
     * @param {string} templateContent
     * @param {object} allTemplatesByPath
     * @param {string} pathToSkip
     * @returns {string[]}
     */
    _getDependantDynamicComponents(templateContent, allTemplatesByPath, pathToSkip) {
        const dependencies = [];

        let match = this.dynamicComponentRegex.exec(templateContent);
        while (match !== null) {
            const dynamicComponents = this._getDynamicComponents(
                match[1],
                allTemplatesByPath,
                pathToSkip,
            );
            dependencies.push(...dynamicComponents);
            match = this.dynamicComponentRegex.exec(templateContent);
        }

        return dependencies;
    }

    /**
     * @private
     * @param {string} componentFolder
     * @param {object} possibleTemplates
     * @param {string} pathToSkip
     * @returns {string[]}
     */
    _getDynamicComponents(componentFolder, possibleTemplates, pathToSkip) {
        return Object.keys(possibleTemplates).reduce((output, templatePath) => {
            if (templatePath.indexOf(componentFolder) === 0 && templatePath !== pathToSkip) {
                output.push(templatePath);
            }
            return output;
        }, []);
    }
}

module.exports = Cycles;
