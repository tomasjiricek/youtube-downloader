const EventEmitter = require('events');
const exec = require('child_process').exec;
const path = require('path');

const PROCESS_OPTIONS = {
    maxBuffer: 10 * 1024 * 1024 // 10 MB; Default is 1 MB which is in some cases not enough
};

function toMp3(input, output, quality = '240k') {
    return _execFfmpegBinary(`-i "${input}"`, '-vn', `-b:a ${quality} "${output}.mp3"`);
}

function toOgg(input, output, ...args) {
    const params = [
        `-i "${input}"`,
        '-vn',
        '-c:a copy',
        args.join(' '),
        `"${output}.ogg"`
    ];
    return _execFfmpegBinary(params);
}

function _execFfmpegBinary(...args) {
    const emitter = new EventEmitter();
    const proc = exec(`ffmpeg ${args.join(' ')}`, PROCESS_OPTIONS);

    proc.stdout.on('data', (data) => {
        emitter.emit('data', data);
    });

    proc.stderr.on('data', (data) => {
        emitter.emit('_error', data);
    });

    proc.on('error', (data) => {
        emitter.emit('error', data);
    });

    proc.on('exit', (code) => {
        emitter.emit('exit', code);
    });

    return emitter;
}

module.exports = {
    toMp3,
    toOgg,
}
