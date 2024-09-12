import { jest } from '@jest/globals';
import fs from 'fs';
import langAssemble from './lang-assembler.js';

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
        langAssemble.assemble((err, result) => {
            const keys = Object.keys(result);
            expect(keys).toHaveLength(langFiles.length);
        });
    });
    it('should return lower case lang keys', () => {
        langAssemble.assemble((err, result) => {
            Object.keys(result).forEach((lang) => {
                expect(lang).toEqual(lang.toLowerCase());
            });
        });
    });
});
