const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

const gdrive = require('./lib/gdrive');
const { logWithTime } = require('./lib/logger');
const ffmpeg = require('./lib/ffmpeg');
const ytdl = require('./lib/ytdl');

const {
    DELETE_FILES_AFTER_SYNC,
    GOOGLE_DRIVE_SYNC_FOLDER_NAME,
    YOUTUBE_PLAYLIST_LINK
} = require('./config.json');

const DOWNLOAD_LOG_PATH = path.join(__dirname, 'downloaded.log');

const convertedMusic = [];

function wipePathDisabledChars(str) {
    return str
        .replace(/[\\\/\:\*\?\<\>\|]/g, '_')
        .replace(/['"\u1000-\uFFFF]/g, '')
        .trim()
        .replace(/ {2,}/g, ' ');
}

function downloadVideo(name, url, options, done) {
    const fileName = wipePathDisabledChars(name);
    const dstPath = path.join(options.tmpDir, fileName);
    let videoInfo;
    let hasErrorOccurred;

    const video = ytdl.download(url, dstPath, options.downOpt);

    logWithTime(`Getting video info for ${name}...`);

    video.on('info', (info) => {
        let mbSize = Math.round((parseInt(info.filesize, 10) / 1024 / 1024) * 100) / 100;

        if (isNaN(mbSize)) {
            mbSize = 0;
        }

        let fileExists;
        let skipped;
        videoInfo = info;
        videoInfo.title = name;

        try {
            const fileStat = fs.statSync(dstPath);
            skipped = fileStat.size === info.filesize;
            fileExists = true;
        } catch (e) {}

        if (!skipped) {
            if (fileExists) {
                fs.unlinkSync(dstPath);
            }
            videoInfo.downloadStartTime = new Date().getTime();
            logWithTime(`Downloading ${name} (${mbSize} MB)...`);
        } else {
            logWithTime(`Skipping download of ${name} - already downloaded`);
            videoInfo.downloadEndTime = video.downloadStartTime;
            videoInfo.skipped = true;
            done(fileName, videoInfo);
        }

    });

    video.on('error', (data) => {
        if (!hasErrorOccurred) {
            logWithTime(`Failed to download ${name} (${url})`);
            hasErrorOccurred = true;
        }
        logWithTime(data);
    });

    video.on('end', function() {
        if (!hasErrorOccurred && videoInfo) {
            videoInfo.downloadEndTime = new Date().getTime();
            done(fileName, videoInfo);
        } else {
            done();
        }
    });
}

function queueDownloadWorker(item, queueItemDone) {
    const url = `https://www.youtube.com/watch?v=${item.id}`;
    downloadVideo(item.title, url, options, (fileName, videoInfo) => {
        if (fileName) {
            videoInfo.fileName = fileName;
            videoInfo.dstDir = options.dstDir;
            videoInfo.tmpDir = options.tmpDir;
            let downloadTime = (videoInfo.downloadEndTime - videoInfo.downloadStartTime) / 1000;
            logWithTime(`Downloaded ${item.title} (${downloadTime}s)`);
            convertToAudioFile(videoInfo, queueItemDone);
        } else {
            logWithTime(`An error occurred while downloading ${item.title}`);
            queueItemDone();
        }
    });
}

function queuePlaylistItems(items, queue, downloadLog) {
    let queuedItemsCount = 0;
    let skippedItems = 0;

    items.forEach((item) => {
        if (downloadLog.indexOf(item.id + ';') !== -1) {
            skippedItems++;
        } else {
            queue.push(item);
            queuedItemsCount++;
        }
    });

    if (skippedItems > 0) {
        logWithTime(`Skipped ${skippedItems} items.`);
    }

    return queuedItemsCount;
}

function startProcess(url, options) {
    let downloadLog = '';
    try {
        downloadLog = fs.readFileSync(DOWNLOAD_LOG_PATH);
    } catch (e) {
        logWithTime(`ERROR: File ${DOWNLOAD_LOG_PATH} does not exist.\nIt will be automatically created with first download.`)
    }

    ytdlGetPlaylistInfo(url, options.infoOpt, (err, items) => {
        if (!err) {
            logWithTime('Info received. Preparing video(s)...');
            const series = [];
            let queuedItemsCount = 0;
            const queue = async.queue(queueDownloadWorker, 3);
            let finalCallback = () => null;

            series.push((seriesTaskDone) => {
                queue.drain = () => {
                    logWithTime('Finished downloading and converting.');
                    seriesTaskDone();
                };

                queuedItemsCount = queuePlaylistItems(items, queue, downloadLog);

                if (queuedItemsCount === 0) {
                    logWithTime('Nothing to download.');
                    queue.kill();
                    seriesTaskDone();
                }
            });

            if (GOOGLE_DRIVE_SYNC_FOLDER_NAME !== null) {
                series.push((done) => {
                    if (queuedItemsCount === 0) {
                        logWithTime('Skipping synchronization.');
                        done();
                    } else {
                        gdrive.synchronize(options.dstDir, GOOGLE_DRIVE_SYNC_FOLDER_NAME, done)
                    }
                });

                if (DELETE_FILES_AFTER_SYNC) {
                    finalCallback = () => {
                        convertedMusic.forEach((dstPath) => {
                            if (fs.existsSync(dstPath)) {
                                fs.unlinkSync(dstPath);
                            }
                        });
                    };
                }
            }

            async.series(series, finalCallback);
        } else {
            logWithTime(err);
            logWithTime(`URL of the playlist: "${YOUTUBE_PLAYLIST_LINK}"`)
        }
    });
}

function convertToAudioFile(video, done) {
    const dstPath = `${video.dstDir}/${video.fileName}`;
    const videoPath = `${video.tmpDir}/${video.fileName}`;

    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }

    logWithTime(`Converting ${video.title}...`);
    const proc = ffmpeg.toMp3(videoPath, dstPath);

    proc.on('exit', (code) => {
        if (code !== 0) {
            logWithTime(`Failed to convert ${video.title}`);
        } else {
            fs.unlinkSync(videoPath);
            fs.appendFileSync(DOWNLOAD_LOG_PATH, `${video.id};${video.title}\n`);
            logWithTime(`Converted ${video.title}`);
            convertedMusic.push(dstPath + '.mp3');
        }
        done();
    });
}

function ytdlGetPlaylistInfo(playlistUrl, options, callback) {
    let args = ['-i', '--dump-single-json'];

    if (options instanceof Array) {
        args = args.concat(options);
    }

    logWithTime('Getting info...');
    const proc = ytdl.getInfo(playlistUrl, args);

    proc.on('info', (data) => {
        callback(null, data.entries);
    });

    proc.on('error', (error) => {
        callback(error);
    });

    proc.on('end', () => {
        // nothing to report
    });
}

const options = {
    downOpt: ['-f', 'bestaudio/best'],
    infoOpt: ['--flat-playlist'],
    dstDir: path.join(__dirname, 'downloads'),
    tmpDir: path.join(__dirname, 'temp')
};

exec(`ps -ef | grep "node ${__dirname}"`, (_, result) => {
    const fileName = __filename.substr(0, __filename.lastIndexOf('.'));
    const lines = result.split('\n')
        .filter(value => (value.indexOf(fileName) !== -1 && value.indexOf('grep ') === -1));

    if (lines.length <= 2) {
        startProcess(YOUTUBE_PLAYLIST_LINK, options);
    } else {
        console.error(`Cannot run ${fileName}: Another process is already running.`);
    }
});
