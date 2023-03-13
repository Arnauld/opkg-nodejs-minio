import { MinioGateway } from '../src/minio.mjs'
import * as assert from 'assert'
import * as fs from 'fs'

describe('minio/opkg', function () {

    it('Update empty repo', async function () {
        const bucketName = "test-" + Date.now()
        const workingDir = './out/' + bucketName
        await fs.promises.mkdir(workingDir, { recursive: true })

        const m = new MinioGateway({ workingDir })

        await m.makeBucket(bucketName)
        await m.updateIndex(bucketName, 'x86_64/')
        const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        assert.equal(data, '')
    });
});