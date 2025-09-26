import { Readable } from 'stream';
import { readStream, tapStream } from './asyncUtils';

describe('readStream', () => {
    it('should read all data from a stream and resolve with the result', async () => {
        const readable = Readable.from(['hello', ' ', 'world']);
        const result = await readStream(readable);
        expect(result).toBe('hello world');
    });
});

describe('tapStream', () => {
    it('should tap into a stream and call onData with the full data', () => {
        const readable = Readable.from(['foo', 'bar']);
        return new Promise((resolve, reject) => {
            const tapped = tapStream(readable, (data) => {
                try {
                    expect(data).toBe('foobar');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            // Consume the tapped stream to trigger data flow
            tapped.resume();
        });
    });
});
