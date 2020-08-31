// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    collectCoverage: false,
    collectCoverageFrom: [
        './bin/**/*.js',
        './server/**/*.js',
        './lib/**/*.js',
        './tasks/**/*.js',
    ],
    coverageDirectory: './.coverage',
    coverageThreshold: {
        global: {
            branches: 33,
            functions: 47,
            lines: 47,
            statements: 47,
        },
    },
    moduleFileExtensions: [
        "js",
        "json",
        "node",
    ],
    testEnvironment: "node",
    testMatch: [
        "**/__tests__/**/*.[jt]s",
        "**/?(*.)+(spec|test).[tj]s",
    ],
};
