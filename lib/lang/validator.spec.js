import path from 'path';
import LangFilesValidator from './validator.js';

describe('lang/validator.js tests', () => {
    describe('valid', () => {
        it('run with no errors', async () => {
            const themePath = path.join(process.cwd(), 'test/_mocks/themes/valid');
            const validator = new LangFilesValidator(themePath);
            const errors = await validator.run();
            expect(errors).toHaveLength(0);
        });
        it('run with no errors providing default lang', async () => {
            const themePath = path.join(process.cwd(), 'test/_mocks/themes/valid');
            const validator = new LangFilesValidator(themePath);
            const errors = await validator.run('en');
            expect(errors).toHaveLength(0);
        });
    });
    describe('not valid', () => {
        it('run with lang helper that is not presented in lang file', async () => {
            const themePath = path.join(process.cwd(), 'test/_mocks/themes/invalid-translations');
            const validator = new LangFilesValidator(themePath);
            const errors = await validator.run();
            expect(errors).toHaveLength(1);
        });
    });
});
