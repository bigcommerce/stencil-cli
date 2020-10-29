// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    collectCoverage: false,
    collectCoverageFrom: ['./bin/**/*.js', './server/**/*.js', './lib/**/*.js', './tasks/**/*.js'],
    coverageDirectory: './.coverage',
    coverageThreshold: {
        global: {
            branches: 40,
            functions: 50,
            lines: 50,
            statements: 50,
        },
    },
    moduleFileExtensions: ['js', 'json', 'node'],
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.[jt]s', '**/?(*.)+(spec|test).[tj]s'],
};
