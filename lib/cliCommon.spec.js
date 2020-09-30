require('colors');

const { printCliResultError, messages } = require('./cliCommon');

describe('cliCommon', () => {
    describe('printCliResultError', () => {
        let consoleLogStub;

        beforeAll(() => {
            consoleLogStub = jest.spyOn(console, 'log').mockImplementation(jest.fn());
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it('should log "Unknown error" and general recommendations if input is empty', () => {
            printCliResultError(null);

            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(consoleLogStub).toHaveBeenCalledWith(expect.stringMatching('Unknown error'));
            expect(consoleLogStub).toHaveBeenCalledWith(messages.visitTroubleshootingPage);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.submitGithubIssue);
        });

        it('should log the passed error and general recommendations if input is a plain Error object with no extra messages', () => {
            const err = new Error('test error');

            printCliResultError(err);

            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(consoleLogStub).toHaveBeenCalledWith(expect.stringMatching(err.toString()));
            expect(consoleLogStub).toHaveBeenCalledWith(messages.visitTroubleshootingPage);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.submitGithubIssue);
        });

        it('should log the passed message and general recommendations if input is a string', () => {
            const errStr = 'test error message';

            printCliResultError(errStr);

            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(consoleLogStub).toHaveBeenCalledWith(expect.stringMatching(errStr));
            expect(consoleLogStub).toHaveBeenCalledWith(messages.visitTroubleshootingPage);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.submitGithubIssue);
        });

        it('should log the error, each field in error.messages and general recommendations if input is an object with error.messages field', () => {
            const err = new Error('test error');
            err.messages = [{ message: 'first_error' }, { message: '2nd_error' }];

            printCliResultError(err);

            expect(consoleLogStub).toHaveBeenCalledTimes(5);
            expect(consoleLogStub).toHaveBeenCalledWith(expect.stringMatching(err.toString()));
            expect(consoleLogStub).toHaveBeenCalledWith(`${err.messages[0].message.red}\n`);
            expect(consoleLogStub).toHaveBeenCalledWith(`${err.messages[1].message.red}\n`);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.visitTroubleshootingPage);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.submitGithubIssue);
        });

        it('should skip non object elements in the error.message array', () => {
            const err = new Error('test error');
            err.messages = [
                { message: 'first_error' },
                'string',
                { message: '2nd_error' },
                undefined,
                null,
                228,
                true,
            ];

            printCliResultError(err);

            expect(consoleLogStub).toHaveBeenCalledTimes(5);
            expect(consoleLogStub).toHaveBeenCalledWith(expect.stringMatching(err.toString()));
            expect(consoleLogStub).toHaveBeenCalledWith(`${'first_error'.red}\n`);
            expect(consoleLogStub).toHaveBeenCalledWith(`${'2nd_error'.red}\n`);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.visitTroubleshootingPage);
            expect(consoleLogStub).toHaveBeenCalledWith(messages.submitGithubIssue);
        });
    });
});
