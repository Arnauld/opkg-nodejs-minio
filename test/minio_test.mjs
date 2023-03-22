import { MinioGateway } from '../src/minio.mjs'
import * as fs from 'fs'
import { assert } from 'chai'
import * as wtf from 'wtfnode'


let inc = 0

describe('minio/opkg', function () {
    let m
    let bucketName
    let workingDir

    beforeEach(async function () {
        bucketName = "test-" + Date.now() + "-" + (inc++)
        workingDir = './out/' + bucketName
        await fs.promises.mkdir(workingDir, { recursive: true })

        m = new MinioGateway({ workingDir })
    });

    afterEach(function () {
        m.close()
        wtf.dump()
    });

    it('Update empty repo', async function () {
        this.timeout(30000); // A very long environment setup.

        await m.makeBucket(bucketName)
        await m.updateIndex(bucketName, 'x86_64/')

        //const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        const raw = await m.rawContent(bucketName, 'x86_64/Packages')
        const data = raw.toString()
        assert.equal(data, '')
    });

    it('Update non-empty repo', async function () {
        this.timeout(30000); // A very long environment setup.

        await m.makeBucket(bucketName)
        await m.uploadFile(bucketName, 'x86_64/automount_1-40_x86_64.ipk', "./samples/repo/automount_1-40_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')

        //const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        const raw = await m.rawContent(bucketName, 'x86_64/Packages')
        const data = raw.toString()
        assert.include(data, 'automount_1-40_x86_64.ipk')
        assert.notInclude(data, 'tcping_0.3-1_x86_64.ipk')
    });


    it('Update existing repo - update existing Packages', async function () {
        this.timeout(30000); // A very long environment setup.

        await m.makeBucket(bucketName)

        //seems there is a leak/not closed connection; that block nodejs to terminate gracefuly
        //m.registerListener({ bucketName, prefix: 'x86_64/' })
        
        await m.uploadFile(bucketName, 'x86_64/automount_1-40_x86_64.ipk', "./samples/repo/automount_1-40_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')

        // clear working dir
        await fs.promises.rm(workingDir, { recursive: true, force: true })
        await fs.promises.mkdir(workingDir, { recursive: true })

        await m.uploadFile(bucketName, 'x86_64/tcping_0.3-1_x86_64.ipk', "./samples/repo/tcping_0.3-1_x86_64.ipk")
        await m.updateIndex(bucketName, 'x86_64/')

        //const data = await fs.promises.readFile(`${workingDir}/x86_64/Packages`, 'utf8');
        const raw = await m.rawContent(bucketName, 'x86_64/Packages')
        const data = raw.toString()
        assert.include(data, 'automount_1-40_x86_64.ipk')
        assert.include(data, 'tcping_0.3-1_x86_64.ipk')
    });
});