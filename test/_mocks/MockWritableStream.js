import stream from "stream";

const { Writable } = stream;
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
export default MockWritableStream;
