import { extractControl } from '../src/arfile.mjs'
import * as fs from 'fs'
import { fileTypeFromFile } from 'file-type';
import * as tar from 'tar'

//const filepath = 'samples/repo/tcping_0.3-1_x86_64.ipk'
const filepath = 'samples/binaries/downloader_0.12.0_cortexa9hf.ipk'

const filetype = await fileTypeFromFile(filepath)
console.log(filetype);

const inStream = fs.createReadStream(filepath)
if (filetype.ext === 'gz') {
    inStream.pipe(
        tar.extract({
            filter: (path, entry) => {
                console.log('tar/extract::1', path)
                return path.includes('control.tar.gz')
            },
            onentry: (entry) => {
                console.log('tar/extract::2', entry)
                entry.pipe(tar.extract({
                    filter: (path, entry) => {
                        console.log('tar/extract::1', path)
                        return path.includes('control')
                    },
                    onentry: (entry) => {

                    }
                }))
                
            }
        })
    )
}
else if (filetype.ext === 'deb') {
    extractControl(inStream).catch(err => console.error(err))
}
