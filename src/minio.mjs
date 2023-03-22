import * as Minio from 'minio'
import { exec } from "child_process"
import { createLogger } from 'bunyan'
import * as fs from 'fs'
import { resolve } from 'path';

const log = createLogger({ name: "minio-gateway" });

const removeTrailingSlash = function (text) {
    if (text.charAt(text.length - 1) == '/') {
        return text.substring(0, text.length - 1)
    }
    return text
}


const endsWithOneOf = function (text, suffixes) {
    for (let index = 0; index < suffixes.length; index++) {
        const suffix = suffixes[index];
        if (text.endsWith(suffix))
            return true
    }
    return false
}

export class MinioGateway {
    constructor({ workingDir }) {
        this.workingDir = workingDir
        this.minioClient = new Minio.Client({
            endPoint: 'localhost',
            port: 9000,
            useSSL: false,
            accessKey: 'console',
            secretKey: 'console_Pwd'
        });
        this.resources = []
    }

    async close() {
        //log.debug('releasing client...', typeof this.minioClient.transport, this.minioClient.transport)
        const self = this
        for (let i = 0; i < this.resources.length; i++) {
            await this.resources[i].apply(self)
        }
        //this.minioClient.transport.closeAllConnections()
    }

    onNotification(record) {
        console.log('notification', record.s3.object)
    }

    registerListener({ bucketName, prefix }) {
        const self = this
        const listener = this.minioClient.listenBucketNotification(bucketName, prefix, "", ['s3:ObjectCreated:*', 's3:ObjectRemoved:*'])
        this.resources.push(async function () {
            log.debug('Freeing listener  ***')
            listener.stop()
            listener.removeAllListeners()
            await self.minioClient.removeAllBucketNotification(bucketName).catch(err => console.error(err))
        })
        listener.on('notification', this.onNotification)
    }

    async generatePackage({ bucketName, prefix, dir }) {
        const self = this
        await fs.promises.mkdir(dir, { recursive: true })

        const cmd = `./vendor/opkg-utils/opkg-make-index -v -a -u -p ${dir}/Packages ${dir}/`
        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    return reject(error)
                }
                if (stderr) {
                    log.warn(`stderr: ${stderr}`);
                }
                log.info(`stdout: ${stdout}`);
                resolve()
            });
        }).then(() => {
            prefix = removeTrailingSlash(prefix)
            const refs = ['Packages', 'Packages.gz', 'Packages.stamps']
            return Promise.all(refs.map(n => {
                log.info(`Updating file ${prefix}/${n}; `)
                return self.minioClient.fPutObject(bucketName, `${prefix}/${n}`, `${dir}/${n}`)
            }))
        })
    }

    async doRebuildIndex({ bucketName, prefix, objs }) {
        const self = this
        const workingDir = this.workingDir
        log.info('Rebuilding index; retrieving packages')

        if (objs.length == 0) {
            return self.generatePackage({ bucketName, prefix, dir: `${workingDir}/${prefix}` })
        }
        else {
            return new Promise((resolve, reject) => {
                const ret = []
                objs.forEach(obj => {
                    self.minioClient.fGetObject(bucketName, obj.name, `${workingDir}/${obj.name}`, function (e) {
                        ret.push(obj)
                        if (e) {
                            log.warn(e)
                            return
                        }
                        log.debug(`File retrieved ${obj.name}`)
                        if (ret.length === objs.length) {
                            self.generatePackage({ bucketName, prefix, dir: `${workingDir}/${prefix}` })
                                .then(resolve)
                                .catch(reject)
                        }
                    })
                });
            })
        }
    }

    async doUpdateIndex({ bucketName, prefix, objs }) {
        const self = this
        prefix = removeTrailingSlash(prefix)
        const pkgArr = objs.filter(p => p.name === `${prefix}/Packages`)
        if (pkgArr.length == 0) {
            return this.doRebuildIndex({ bucketName, prefix, objs })
        }
        const pkg = pkgArr[0]
        const refs = ['Packages', 'Packages.gz', 'Packages.stamps']
        const objArr = objs.filter(p => p.lastModified > pkg.lastModified && !endsWithOneOf(p.name, refs))
        if (objArr.length > 0) {
            refs.forEach(ref => objArr.push({ name: `${prefix}/${ref}` }))
            log.info(`Packages already exists; updating #${objArr.length} entries`, objArr.map(p => p.name))
            return self.doRebuildIndex({ bucketName, prefix, objs: objArr })
        }
        else {
            log.info('Packages already exists; nothing to update')
        }
    }

    async updateIndex(bucketName, prefix) {
        const self = this
        return new Promise((resolve, reject) => {
            let config = { bucketName, prefix, objs: [] }
            const stream = self.minioClient.listObjectsV2(bucketName, prefix)
            stream.on('data', function (obj) {
                config.objs.push(obj)
            })
            stream.on('error', function (err) { reject(err) })
            stream.on('end', function () {
                self.doUpdateIndex(config).then(resolve).catch(reject)
            })
        })
    }

    async makeBucket(bucketName) {
        return this.minioClient.makeBucket(bucketName)
    }

    async uploadFile(bucketName, objectName, localFilePath) {
        return this.minioClient.fPutObject(bucketName, objectName, localFilePath)
    }

    async rawContent(bucketName, objectName) {
        return new Promise((resolve, reject) => {
            const buffer = []
            this.minioClient.getObject(bucketName, objectName, function (err, dataStream) {
                if (err) {
                    return reject(err)
                }
                dataStream.on('data', function (chunk) {
                    buffer.push(chunk)
                })
                dataStream.on('end', function () {
                    resolve(Buffer.concat(buffer))
                })
                dataStream.on('error', function (err) {
                    return reject(err)
                })
            })
        })
    }
}
