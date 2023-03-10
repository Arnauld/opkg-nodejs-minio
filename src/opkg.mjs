const PREDEFINED = [
    'package',
    'version',
    'parsed_version',
    'architecture',
    'maintainer',
    'source',
    'description',
    'depends',
    'provides',
    'replaces',
    'conflicts',
    'recommends',
    'suggests',
    'section',
    'filename_header',
    'installed_size',
    'filename',
    'file_ext_opk',
    'homepage',
    'oe',
    'priority',
    'tags',
    'fn',
    'license'
]

export const parse_control = function (text) {
    console.log(text)
    const re = new RegExp(/([^:]+):\s*(.*)/);
    const attrs = {}
    const ordered = []
    const parts = text.split('\n')
    for (let i = 0; i < parts.length; i++) {
        const line = parts[i];
        const match = line.match(re)
        if (match) {
            const name = match[1]
            const lowered = name.toLowerCase()
            let value = match[2]
            // multiline value?
            while ((i + 1) < parts.length) {
                if (parts[i + 1].startsWith(' ')) {
                    value = value + '\n' + parts[i + 1]
                    i = i + 1
                }
                else break;
            }

            let key = name
            if (lowered === 'size')
                value = parseInt(value)
            else if (lowered === 'md5sum')
                key = 'md5'
            else if (lowered === 'sha256sum')
                key = 'sha256'
            else if (PREDEFINED.includes(lowered))
                key = lowered
            ordered.push(name)
            attrs[key] = value
        }
    }
    return { attrs, ordered }
}