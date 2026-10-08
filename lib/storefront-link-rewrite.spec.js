import {
    buildStorefrontLinkPattern,
    createStorefrontLinkRewriteRule,
} from './storefront-link-rewrite.js';

const LOCAL_HOST = 'localhost:3000';

// Applies the rule the same way BrowserSync (resp-modifier) does.
const rewrite = (html, storeUrl = 'https://www.example.com') => {
    const rule = createStorefrontLinkRewriteRule(storeUrl);
    return html.replace(rule.match, (...args) =>
        rule.fn({ headers: { host: LOCAL_HOST } }, {}, ...args),
    );
};

describe('createStorefrontLinkRewriteRule', () => {
    describe('rewrites links to the storefront host', () => {
        it.each([
            ['https link', 'https://www.example.com/products', 'http://localhost:3000/products'],
            ['http link', 'http://www.example.com/products', 'http://localhost:3000/products'],
            [
                'protocol-relative link',
                '//www.example.com/products',
                'http://localhost:3000/products',
            ],
            [
                'uppercase link',
                'HTTPS://WWW.EXAMPLE.COM/products',
                'http://localhost:3000/products',
            ],
            ['host with no path', 'https://www.example.com', 'http://localhost:3000'],
            ['host then query', 'https://www.example.com?a=1', 'http://localhost:3000?a=1'],
            ['host then hash', 'https://www.example.com#top', 'http://localhost:3000#top'],
            ['host in double quotes', '"https://www.example.com"', '"http://localhost:3000"'],
            ['host in single quotes', "'https://www.example.com'", "'http://localhost:3000'"],
            ['host then <', 'https://www.example.com</a>', 'http://localhost:3000</a>'],
            [
                'host at end of sentence',
                'Visit https://www.example.com.',
                'Visit http://localhost:3000.',
            ],
            [
                'JSON-escaped link',
                String.raw`"https:\/\/www.example.com\/products"`,
                String.raw`"http:\/\/localhost:3000\/products"`,
            ],
            [
                'JSON-escaped protocol-relative link',
                String.raw`"\/\/www.example.com\/products"`,
                String.raw`"http:\/\/localhost:3000\/products"`,
            ],
            [
                'link in a query param of another link',
                'https://other.test/?r=https://www.example.com/x',
                'https://other.test/?r=http://localhost:3000/x',
            ],
        ])('%s', (_name, input, expected) => {
            expect(rewrite(input)).toBe(expected);
        });

        it('rewrites all links in a document', () => {
            const html = [
                '<a href="https://www.example.com/a">A</a>',
                '<img src="//www.example.com/b.png">',
                String.raw`<script>{"url":"https:\/\/www.example.com\/c"}</script>`,
            ].join('\n');

            expect(rewrite(html)).toBe(
                [
                    '<a href="http://localhost:3000/a">A</a>',
                    '<img src="http://localhost:3000/b.png">',
                    String.raw`<script>{"url":"http:\/\/localhost:3000\/c"}</script>`,
                ].join('\n'),
            );
        });

        it('gives the same result when the rule is used more than once', () => {
            // A global RegExp keeps lastIndex; String.prototype.replace must reset it.
            const rule = createStorefrontLinkRewriteRule('https://www.example.com');
            const apply = (html) =>
                html.replace(rule.match, (...args) =>
                    rule.fn({ headers: { host: LOCAL_HOST } }, {}, ...args),
                );

            expect(apply('https://www.example.com/a')).toBe('http://localhost:3000/a');
            expect(apply('https://www.example.com/a')).toBe('http://localhost:3000/a');
        });

        it('uses the Host header of the request', () => {
            const rule = createStorefrontLinkRewriteRule('https://www.example.com');
            const result = 'https://www.example.com/a'.replace(rule.match, (...args) =>
                rule.fn({ headers: { host: '127.0.0.1:4000' } }, {}, ...args),
            );

            expect(result).toBe('http://127.0.0.1:4000/a');
        });
    });

    describe('does not change links to other hosts', () => {
        it.each([
            ['longer host (subdomain suffix)', 'https://www.example.com.evil.test/'],
            ['longer host (hyphen)', 'https://www.example.com-evil.test/'],
            ['longer host (more letters)', 'https://www.example.community/'],
            ['subdomain of the host', 'https://shop.www.example.com/'],
            ['parent domain', 'https://example.com/'],
            ['same host, other port', 'https://www.example.com:8443/'],
            ['host with trailing dot (FQDN)', 'https://www.example.com./x'],
            ['host with user info', 'https://user@www.example.com/'],
            ['host with no slashes', 'www.example.com/products'],
            ['host as a path segment', '/www.example.com/products'],
            ['other scheme', 'ftp://www.example.com/'],
            ['host after // in a path', 'https://other.test//www.example.com/'],
            ['dot in host is not a wildcard', 'https://wwwXexampleYcom/'],
        ])('%s', (_name, input) => {
            expect(rewrite(input)).toBe(input);
        });
    });

    describe('known limits (not rewritten)', () => {
        it.each([
            ['URL-encoded link', 'https%3A%2F%2Fwww.example.com%2Fx'],
            ['double JSON-escaped link', String.raw`https:\\\/\\\/www.example.com`],
        ])('%s', (_name, input) => {
            expect(rewrite(input)).toBe(input);
        });

        it('does not rewrite the bare domain when the store URL has www', () => {
            expect(rewrite('https://example.com/x')).toBe('https://example.com/x');
        });
    });

    describe('store URL with a port', () => {
        const storeUrl = 'https://store.test:8443';

        it('rewrites links with the same port', () => {
            expect(rewrite('https://store.test:8443/x', storeUrl)).toBe('http://localhost:3000/x');
        });

        it.each([
            ['no port', 'https://store.test/x'],
            ['other port', 'https://store.test:9443/x'],
            ['longer port', 'https://store.test:84430/x'],
        ])('does not rewrite links with %s', (_name, input) => {
            expect(rewrite(input, storeUrl)).toBe(input);
        });
    });

    it('ignores a default port in the store URL', () => {
        // `new URL('https://host:443').host` is `host`.
        expect(rewrite('https://www.example.com/x', 'https://www.example.com:443')).toBe(
            'http://localhost:3000/x',
        );
    });
});

describe('buildStorefrontLinkPattern', () => {
    it('escapes regex characters in the host', () => {
        const pattern = buildStorefrontLinkPattern('a.b');

        expect('https://a.b/'.match(pattern)).toEqual(['https://a.b']);
        expect('https://aXb/'.match(pattern)).toBeNull();
    });
});
