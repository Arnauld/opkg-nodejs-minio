import { MinioGateway } from '../src/minio.mjs'
import * as fs from 'fs'
import { assert } from 'chai'
let inc = 0

describe('minio/opkg', function () {

    it('Update empty repo', async function () {
        const bucketName = "test-" + Date.now() + "-" + (inc++)
        const workingDir = './out/' + bucketName
        await fs.promises.mkdir(workingDir, { recursive: true })

        const m = new MinioGateway({ workingDir })

        await m.makeBucket(bucketName)
        await m.updateIndex(bucketName, 'x86_64/')
        const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        assert.equal(data, '')
    });

    it('Update non-empty repo', async function () {
        const bucketName = "test-" + Date.now() + "-" + (inc++)
        const workingDir = './out/' + bucketName
        await fs.promises.mkdir(workingDir, { recursive: true })

        const m = new MinioGateway({ workingDir })

        await m.makeBucket(bucketName)
        await m.uploadFile(bucketName, 'x86_64/automount_1-40_x86_64.ipk', "./samples/repo/automount_1-40_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')
        const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        assert.include(data, 'automount_1-40_x86_64.ipk')
    });


    it('Update existing repo - update existing Packages', async function () {
        const bucketName = "test-" + Date.now() + "-" + (inc++)
        const workingDir = './out/' + bucketName
        await fs.promises.mkdir(workingDir, { recursive: true })
        
        const m = new MinioGateway({ workingDir })
        
        await m.makeBucket(bucketName)
        await m.uploadFile(bucketName, 'x86_64/automount_1-40_x86_64.ipk', "./samples/repo/automount_1-40_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')
        
        // clear working dir
        await fs.promises.rm(workingDir, { recursive: true, force: true })
        await fs.promises.mkdir(workingDir, { recursive: true })

        await m.uploadFile(bucketName, 'x86_64/tcping_0.3-1_x86_64.ipk', "./samples/repo/tcping_0.3-1_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')

        const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        assert.include(data, 'automount_1-40_x86_64.ipk')
        assert.include(data, 'tcping_0.3-1_x86_64.ipk')
    });
});