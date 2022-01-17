const fs = require('fs');
const { getFrontmatterContent } = require('./frontmatter');

const cwd = process.cwd();

describe('frontmatter', () => {
    it('should successfully get frontmatter content fromt file', async () => {
        const fileName = `${cwd}/test/_mocks/frontmatter/valid.html`;
        const fileContent = await fs.promises.readFile(fileName, { encoding: 'utf-8' });
        const frontmatter = getFrontmatterContent(fileContent);
        expect(frontmatter).not.toBeNull();
    });

    it('should return null while getting frontmatter content fromt file', async () => {
        const fileName = `${cwd}/test/_mocks/frontmatter/absent.html`;
        const fileContent = await fs.promises.readFile(fileName, { encoding: 'utf-8' });
        const frontmatter = getFrontmatterContent(fileContent);
        expect(frontmatter).toBeNull();
    });
});
