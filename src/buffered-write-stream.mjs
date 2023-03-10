import * as stream from 'stream'
import { Buffer } from 'node:buffer';

/* Writable memory stream */
export class BufferBasedWritableStream extends stream.Writable {
    constructor(options) {
        super()
        stream.Writable.call(this, { objectMode: true, ...options });
        this.buffer = Buffer.alloc(0); // empty
    }
    _write(chunk, enc, cb) {
        // our memory store stores things in buffers
        var buffer = Buffer.isBuffer(chunk) ?
            chunk :  // already is Buffer use it
            Buffer.from(chunk, enc);  // string, convert

        // concat to the buffer already there
        this.buffer = Buffer.concat([this.buffer, buffer]);
        cb();
    };
}