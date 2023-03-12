import * as Minio from 'minio'
import { exec } from "child_process"

const minioClient = new Minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'console',
    secretKey: 'console_Pwd'
});

const removeTrailingSlash = function (text) {
    if (text.charAt(text.length - 1) == '/') {
        return text.substring(0, text.length - 1)
    }
    return text
}

const generatePackage = async function ({ bucket, prefix, dir }) {
    const cmd = `./vendor/opkg-utils/opkg-make-index -p ${dir}/Packages ${dir}/`
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
    prefix = removeTrailingSlash(prefix)
    const refs = ['Packages', 'Packages.gz', 'Packages.stamps']

    refs.forEach(async n => {
        console.log(`Updating file ${prefix}/${n}; `)
        await minioClient.fPutObject(bucket, `${prefix}/${n}`, `${dir}/${n}`)
    })
}

const doRebuildIndex = async function ({ bucket, prefix, objs }) {
    console.log('Rebuilding index; retrieving packages')
    const ret = []
    objs.forEach(obj => {
        minioClient.fGetObject(bucket, obj.name, `out/${obj.name}`, function (e) {
            ret.push(obj)
            if (e) {
                return console.error(e)
            }
            console.log(`doRebuildIndex::fGetObject::${obj.name}`)
            if (ret.length === objs.length) {
                generatePackage({ bucket, prefix, dir: `out/${prefix}` })
            }
        })
    });
    console.log(`doRebuildIndex::()`)
}

const endsWithOneOf = function (text, suffixes) {
    for (let index = 0; index < suffixes.length; index++) {
        const suffix = suffixes[index];
        if (text.endsWith(suffix))
            return true
    }
    return false
}

const doUpdateIndex = async function ({ bucket, prefix, objs }) {
    prefix = removeTrailingSlash(prefix)
    const pkgArr = objs.filter(p => p.name === `${prefix}/Packages`)
    if (pkgArr.length == 0) {
        return doRebuildIndex({ bucket, prefix, objs })
    }
    const pkg = pkgArr[0]
    const refs = ['Packages', 'Packages.gz', 'Packages.stamps']
    const objArr = objs.filter(p => p.lastModified > pkg.lastModified && !endsWithOneOf(p.name, refs))
    if (objArr.length > 0) {
        refs.forEach(ref => objArr.push({ name: `${prefix}/${ref}` }))
        console.log(`Packages already exists; updating #${objArr.length} entries`, objArr.map(p => p.name))
        return doRebuildIndex({ bucket, prefix, objs: objArr })
    }
    else {
        console.log('Packages already exists; nothing to update')
    }
}

const updateIndex = async function (bucket, prefix) {
    return new Promise((resolve, reject) => {
        let config = { bucket, prefix, objs: [] }
        const stream = minioClient.listObjectsV2(bucket, prefix)
        stream.on('data', function (obj) {
            config.objs.push(obj)
        })
        stream.on('error', function (err) { reject(err) })
        stream.on('end', function () {
            doUpdateIndex(config)
        })
    })
}

updateIndex('tenant1', 'x86_64/').catch(err => console.error(err))