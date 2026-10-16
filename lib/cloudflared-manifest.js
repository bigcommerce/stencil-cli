// Pinned cloudflared release. To update, set the version and copy each asset's sha256 from the
// `digest` field of https://api.github.com/repos/cloudflare/cloudflared/releases/tags/<version>.
const CLOUDFLARED_MANIFEST = {
    version: '2026.10.0',
    assets: {
        'darwin-x64': {
            name: 'cloudflared-darwin-amd64.tgz',
            sha256: '903845b81828c8cb3c5d13d816a2de71c06a3da5785469df8eb0e1b736d92f9f',
        },
        'darwin-arm64': {
            name: 'cloudflared-darwin-arm64.tgz',
            sha256: 'a2f79ff7b9420aa537d74af239f376da170bbabeb529aec416002adac6a72e70',
        },
        'linux-x64': {
            name: 'cloudflared-linux-amd64',
            sha256: 'd33ff2d14475178d2012c2c56beba87389ac5ded27649519f198a7d3134a99db',
        },
        'linux-arm64': {
            name: 'cloudflared-linux-arm64',
            sha256: 'e6422b9d4f72d3194bc5a38676f13667c06666523217b842a877d72a80b5ac08',
        },
        'linux-arm': {
            name: 'cloudflared-linux-arm',
            sha256: '1dbe8e4ec17e74bb7f49cf91db6a4903bd0f9fe41984556c7503e40b765fd099',
        },
        'linux-ia32': {
            name: 'cloudflared-linux-386',
            sha256: 'f6fbd789e6ce9c824d4d560cbbfad2753d55ce398ece16b4c9fbf17271dceab3',
        },
        'win32-x64': {
            name: 'cloudflared-windows-amd64.exe',
            sha256: '86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c',
        },
        'win32-ia32': {
            name: 'cloudflared-windows-386.exe',
            sha256: '0630a8779e9823a1a3b091698b8e71874e0f7b205559219f52fdd301466b5546',
        },
    },
};

export default CLOUDFLARED_MANIFEST;
