import { extractControl } from '../src/arfile.mjs'
import * as fs from 'fs'
import { fileTypeFromFile } from 'file-type';
import * as tar from 'tar'
import { BufferBasedWritableStream } from '../src/buffered-write-stream.mjs'
import { parse_control } from '../src/opkg.mjs';

const filepath = 'samples/repo/python-flup_1.0.1-ml0.3-py2.7_armv7a.ipk'
//const filepath = 'samples/repo/tcping_0.3-1_arm_cortex-a7_neon-vfpv4.ipk'
//const filepath = 'samples/repo/automount_1-40_x86_64.ipk'
//const filepath = 'samples/repo/grep_3.8-2_armv7-3.2.ipk'
//const filepath = 'samples/repo/libgcc_8.4.0-11_armv7-3.2.ipk'
//const filepath = 'samples/repo/ffmpeg_5.1.2-1_armv7-3.2.ipk'
//const filepath = 'samples/repo/tcping_0.3-1_x86_64.ipk'
//const filepath = 'samples/binaries/downloader_0.12.0_cortexa9hf.ipk'

const filetype = await fileTypeFromFile(filepath)
console.log(filetype);


const extractContent = async function (inStream) {
    return new Promise((resolve, reject) => {
        if (filetype.ext === 'gz') {
            inStream.pipe(
                tar.list({
                    filter: (path, entry) => {
                        return path.includes('control.tar.gz')
                    },
                    onentry: (entry) => {
                        entry.pipe(tar.list({
                            filter: (path, entry) => {
                                return path.endsWith('control')
                            },
                            onentry: (entry) => {
                                const bws = new BufferBasedWritableStream()
                                bws.on('finish', () => resolve(bws.buffer.toString()))
                                entry.pipe(bws)
                            }
                        }))

                    }
                })
            )
        }
        else if (filetype.ext === 'deb' || filetype.ext === 'ar') {
            extractControl(inStream).catch(err => reject(err)).then(value => resolve(value))
        }
        else {
            reject(new Error('Unsupported archive type'))
        }
    })
}

const inStream = fs.createReadStream(filepath)
extractContent(inStream).then(content => console.log(parse_control(content)))