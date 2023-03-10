import * as strtok3 from 'strtok3/core'
import * as Token from 'token-types'
import { Buffer } from 'buffer'
import { EndOfStreamError } from 'strtok3'
import * as tar from 'tar'
import { Readable } from 'stream'
import { BufferBasedWritableStream } from './buffered-write-stream.mjs'

const MAGIC_AR_HEADER = '!<arch>\n'

const parseFileHeader = function (buffer) {
    const fileIdentifier = buffer.subarray(0, 16).toString('ascii').trim()
    const timestamp = new Date(parseInt(buffer.subarray(16, 16 + 12).toString('ascii').trim()) * 1000)
    const ownerId = buffer.subarray(28, 28 + 6).toString('ascii')
    const groupId = buffer.subarray(34, 34 + 6).toString('ascii')
    const fileMode = buffer.subarray(40, 40 + 8).toString('ascii')
    const fileSize = parseInt(buffer.subarray(48, 48 + 10).toString('ascii').trim())
    return { fileIdentifier, timestamp, ownerId, groupId, fileMode, fileSize }
}

const readFileHeader = async function (tokenizer) {
    const fileHeaderBuffer = Buffer.alloc(60)
    await tokenizer.readBuffer(fileHeaderBuffer)
    const header = parseFileHeader(fileHeaderBuffer);
    return header
}

export const extractControl = async function (inStream) {
    return new Promise(async (resolve, reject) => {

        const tokenizer = await strtok3.fromStream(inStream)

        const magicNumber = await tokenizer.readToken(new Token.StringType(MAGIC_AR_HEADER.length, 'ascii'));
        if (magicNumber !== MAGIC_AR_HEADER) {
            throw new Error("Invalid magic header; invalid archive file format, got: '" + magicNumber + "'");
        }

        try {
            while (true) {
                let header = await readFileHeader(tokenizer)
                console.log(header)
                if (header.fileIdentifier === 'debian-binary') {
                    const version = await tokenizer.readToken(new Token.StringType(header.fileSize))
                    console.log('debian version', version)
                    if (version !== "2.0\n")
                        console.warn('Invalid debian version, ignoring... got: ', version)
                }
                else if (header.fileIdentifier.includes('control.tar.gz')) {
                    console.log('scanning control.tar.gz')
                    const buffer = Buffer.alloc(header.fileSize)
                    await tokenizer.readBuffer(buffer)
                    if(header.fileSize % 2 !== 0)
                        await tokenizer.ignore(1)
                    const stream = Readable.from(buffer)
                    await stream.pipe(tar.list({
                        filter: (path, entry) => {
                            console.log('ar/tar/extract::1', path)
                            return path.includes('control')
                        },
                        onentry: (entry) => {
                            const bws = new BufferBasedWritableStream()
                            bws.on('finish', () => resolve(bws.buffer.toString()))
                            entry.pipe(bws)
                        }
                    }))
                    return
                }
                else {
                    if(header.fileSize % 2 !== 0)
                        await tokenizer.ignore(header.fileSize + 1)
                    else
                        await tokenizer.ignore(header.fileSize)
                }
            }
        } catch (err) {
            if (err instanceof EndOfStreamError) {
                throw new Error('File not found...')
            }
            throw err
        }
    })
}
