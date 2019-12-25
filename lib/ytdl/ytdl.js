const EventEmitter = require('events');
const exec = require('child_process').exec;
const path = require('path');

const YTDL_MODULE_PATH = path.join(__dirname, 'node_modules/youtube-dl/bin/youtube-dl');
const PROCESS_OPTIONS = {
    maxBuffer: 10 * 1024 * 1024 // 10 MB; Default is 1 MB which is in some cases not enough
};

function download(url, dstPath, options) {
    const emitter = new EventEmitter();
    const args = options.concat(['--print-json', '-o', `'${dstPath}'`]);

    const proc = exec(`python ${YTDL_MODULE_PATH} ${args.join(' ')} ${url}`, PROCESS_OPTIONS);

    let temporaryJson = '';
    let finalJson = null;

    proc.stdout.on('data', (data) => {
        temporaryJson += data;
        finalJson = tryReparsingJson(temporaryJson);

        if (finalJson !== null) {
            emitter.emit('info', finalJson);
        }
    });

    proc.stderr.on('data', (data) => {
        emitter.emit('error', data);
    });

    proc.on('error', (data) => {
        emitter.emit('error', data);
    });

    proc.on('exit', (code) => {
        if (finalJson === null) {
            finalJson = tryReparsingJson(temporaryJson);
            if (finalJson !== null) {
                emitter.emit('info', finalJson);
            }
        }
        emitter.emit('end', code);
    });

    return emitter;
}

function tryReparsingJson(jsonData) {
    let json = null;
    try {
        const tmpJson = JSON.parse(jsonData);
        json = tmpJson;
    } catch (e) {
        // nothing to catch, JSON is not complete yet
    }
    return json;
}

function getInfo(url, options) {
    const emitter = new EventEmitter();

    const proc = exec(`python ${YTDL_MODULE_PATH} ${options.join(' ')} ${url}`, PROCESS_OPTIONS);

    let temporaryJson = '';
    let finalJson = null;

    proc.stdout.on('data', (data) => {
        temporaryJson += data;
        finalJson = tryReparsingJson(temporaryJson);

        if (finalJson !== null) {
            emitter.emit('info', finalJson);
        }
    });

    proc.stderr.on('data', (data) => {
        emitter.emit('error', data);
    });

    proc.on('error', (data) => {
        emitter.emit('error', data);
    });

    proc.on('exit', (code) => {
        if (finalJson === null) {
            finalJson = tryReparsingJson(temporaryJson);
            if (finalJson !== null) {
                emitter.emit('info', finalJson);
            }
        }
        emitter.emit('end', code);
    });

    return emitter;
}

module.exports = {
    download: download,
    getInfo: getInfo
};
