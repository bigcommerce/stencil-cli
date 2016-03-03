var Graph = require('tarjan-graph');
var util = require('util');

/**
 *
 * @param {array} templatePaths
 * @constructor
 */
function Cycles(templatePaths) {
    if (! Array.isArray(templatePaths)) {
        throw new Error('templatePaths Must be Array');
    }

    this.templatePaths = templatePaths;
}

/**
 * Runs a graph based cyclical dependency check.
 */
Cycles.prototype.detect = function () {
    detectCycles.call(this);
};

function detectCycles() {
    var partialRegex = /\{\{>\s*([_|\-|a-zA-Z0-9\/]+)[^{]*?}}/g;
    var dynamicComponentRegex = /\{\{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9\/]+)(?:'|").*?}}/g;

    this.templatePaths.forEach(function (fileName) {
        var graph = new Graph();
        var dynamicComponents;
        var match;
        var matches;
        var partial;
        var partialPath;
        var prop;

        for (prop in fileName) {
            if (fileName.hasOwnProperty(prop)) {
                matches = [];
                partial = fileName[prop];
                match = partialRegex.exec(partial);
                while (match !== null) {
                    partialPath = match[1];
                    matches.push(partialPath);
                    match = partialRegex.exec(partial);
                }

                match = dynamicComponentRegex.exec(partial);

                while (match !== null) {
                    dynamicComponents = getDynamicComponents(match[1], fileName);
                    matches.push.apply(matches, dynamicComponents);
                    match = dynamicComponentRegex.exec(partial);

                }

                graph.add(prop, matches);
            }
        }

        if (graph.hasCycle()) {
            throw new Error('Circular dependency in template detected. \r\n' + util.inspect(graph.getCycles()));
        }

    });
}

function getDynamicComponents(componentFolder, possibleTemplates) {
    var output = [];
    var prop;

    for (prop in possibleTemplates) {
        if (possibleTemplates.hasOwnProperty(prop)) {
            if (prop.indexOf(componentFolder) === 0) {
                output.push(prop);
            }
        }
    }

    return output;
}

module.exports = Cycles;
