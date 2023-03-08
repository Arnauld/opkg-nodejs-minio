import { extractControl } from '../src/arfile.mjs'
import * as fs from 'fs'

const inStream = fs.createReadStream('samples/binaries/downloader_0.12.0_cortexa9hf.ipk')
extractControl(inStream).catch(err => console.error(err))