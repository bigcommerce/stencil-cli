const { Writable } = require('stream');

class MockWritableStream extends Writable {
    constructor() {
        super();
        this.buffer = '';
    }

    _write(chunk, _, next) {
        this.buffer += chunk;
        next();
    }

    reset() {
        this.buffer = '';
    }
}

module.exports = MockWritableStream;
