const fs = require('fs');
const { assemble } = require('./lang-assembler');

describe('lang-assembler', () => {
    const langFiles = ['en.json', 'pt-BR.json', 'pt.json', 'fr.json', 'fr-CA.json'];
    beforeEach(() => {
        jest.spyOn(fs, 'readdir').mockImplementation((dir, cb) => {
            cb(null, langFiles);
        });
        jest.spyOn(fs, 'readFile').mockImplementation((filename, encoding, cb) => {
            cb(null, filename);
        });
    });

    it('should run lang assemble task successfully', async () => {
        assemble((err, result) => {
            const keys = Object.keys(result);
            expect(keys).toHaveLength(langFiles.length);
        });
    });

    it('should return lower case lang keys', () => {
        assemble((err, result) => {
            Object.keys(result).forEach((lang) => {
                expect(lang).toEqual(lang.toLowerCase());
            });
        });
    });
});
