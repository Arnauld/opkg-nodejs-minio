import * as strtok3 from 'strtok3/core'
import * as Token from 'token-types';
import { Buffer } from 'buffer'
import { EndOfStreamError } from 'strtok3';

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

const tarChecksumMatches = function(buffer) {
    const str = buffer.toString('utf8', 148, 154).replace(/\0.*$/, '')
    const readSum = Number.parseInt(str.trim(), 8); // Read sum in header
	console.log('tarChecksumMatches:', readSum, str)
    if (Number.isNaN(readSum)) {
		return false;
	}

	let sum = 8 * 0x20; // Initialize signed bit sum

	for (let index = offset; index < offset + 148; index++) {
		sum += buffer[index];
	}

	for (let index = offset + 156; index < offset + 512; index++) {
		sum += buffer[index];
	}

	return readSum === sum;
}

export const extractControl = async function (inStream) {
    const tokenizer = await strtok3.fromStream(inStream)

    // check if tar
    const buffer = Buffer.alloc(512)
    const read = await tokenizer.peekBuffer(buffer, { mayBeLess: true })
    console.log('bytes read:', read)
    if(tarChecksumMatches(buffer)) {
        console.log("tar file!")
        return
    }

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
            else if (header.fileIdentifier === 'control.tar.gz') {
                tokenizer.ignore(header.fileSize)
            }
            else
                tokenizer.ignore(header.fileSize)
        }
    } catch (err) {
        if (err instanceof EndOfStreamError) {
            throw new Error('File not found...')
        }
        throw err
    }
}
