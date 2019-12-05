const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const ytdl = require('./lib/ytdl');

const {
    GOOGLE_DRIVE_SYNC_FOLDER_ID,
    YOUTUBE_PLAYLIST_LINK
} = require('./secrets.json');

const DOWNLOAD_LOG_PATH = path.join(__dirname, 'downloaded.log');

let skippedItems = 0;

function wipePathDisabledChars(str) {
    return str
        .replace(/[\\\/\:\*\?\<\>\|]/g, '_')
        .replace(/['"\u1000-\uFFFF]/g, '')
        .trim();
}

function downloadVideo(name, url, options, done) {
    const fileName = wipePathDisabledChars(name);
    const dstPath = path.join(options.tmpDir, fileName);
    let videoInfo;
    let hasErrorOccurred;

    const video = ytdl.download(url, dstPath, options.downOpt);

    console.log(`Getting video info for ${name}...`);

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
            console.log(`Downloading ${name} (${mbSize} MB)...`);
        } else {
            console.log(`Skipping download of ${name} - already downloaded`);
            videoInfo.downloadEndTime = video.downloadStartTime;
            videoInfo.skipped = true;
            done(fileName, videoInfo);
        }

    });

    video.on('error', (data) => {
        if (!hasErrorOccurred) {
            console.log(`Failed to download ${name} (${url})`);
            hasErrorOccurred = true;
        }
        console.log(data);
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
            console.log(`Downloaded ${item.title} (${downloadTime}s)`);
            convertToAudioFile(videoInfo, queueItemDone);
        } else {
            console.log(`An error occurred while downloading ${item.title}`);
            queueItemDone();
        }
    });
}

function queuePlaylistItems(items, queue, downloadLog) {
    let queuedItemsCount = 0;

    items.forEach((item) => {
        if (downloadLog.indexOf(item.id + ';') !== -1) {
            skippedItems++;
        } else {
            queue.push(item);
            queuedItemsCount++;
        }
    });

    if (skippedItems > 0) {
        console.log(`Skipped ${skippedItems} items.`);
    }

    return queuedItemsCount;
}

function startProcess(url, options) {
    let downloadLog = '';
    try {
        downloadLog = fs.readFileSync(DOWNLOAD_LOG_PATH);
    } catch (e) {
        console.log(`ERROR: File ${DOWNLOAD_LOG_PATH} does not exist.\nIt will be automatically created with first download.`)
    }

    ytdlGetPlaylistInfo(url, options.infoOpt, (err, items) => {
        if (!err) {
            console.log('Info received. Preparing video(s)...');
            const series = [];
            const queue = async.queue(queueDownloadWorker, 3);

            series.push((seriesTaskDone) => {
                queue.drain = () => {
                    console.log('Finished downloading and converting.');
                    seriesTaskDone();
                };

                const queuedItemsCount = queuePlaylistItems(items, queue, downloadLog);

                if (queuedItemsCount === 0) {
                    queue.drain();
                }
            });

            if (GOOGLE_DRIVE_SYNC_FOLDER_ID !== null) {
                series.push(synchronizeDownloads.bind(this, options.dstDir));
            }

            async.series(series);
        } else {
            console.log(err);
            console.log(`URL of the playlist: "${YOUTUBE_PLAYLIST_LINK}"`)
        }
    });
}

function convertToAudioFile(video, done) {
    const newFileName = video.fileName + '.' + getFinalAudioExtension(video.ext);
    const dstPath = `${video.dstDir}/${newFileName}`;

    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }

    console.log(`Converting ${video.title}...`);
    const avConv = exec(`ffmpeg -i "${video.tmpDir}/${video.fileName}" -vn -c:a copy "${dstPath}"`);

    avConv.on('exit', (code) => {
        if (code !== 0) {
            console.log(`Failed to convert ${video.title}`);
        } else {
            fs.unlinkSync(`${video.tmpDir}/${video.fileName}`);
            fs.appendFileSync(DOWNLOAD_LOG_PATH, `${video.id};${video.title}\n`);
            console.log(`Converted ${video.title}`);
        }
        done();
    });
}

function ytdlGetPlaylistInfo(playlistUrl, options, callback) {
    let args = ['-i', '--dump-single-json'];

    if (options instanceof Array) {
        args = args.concat(options);
    }

    console.log('Getting info...');
    const playlistProcess = ytdl.getInfo(playlistUrl, args);

    playlistProcess.on('info', (data) => {
        callback(null, data.entries);
    });

    playlistProcess.on('error', (error) => {
        callback(error);
    });

    playlistProcess.on('end', (code) => {
        // nothing to report
    });
}

function getFinalAudioExtension(originalExt) {
    return originalExt.toLowerCase() === 'webm' ? 'ogg' : originalExt;
}

function synchronizeDownloads(dstDir, done) {
    console.log('Started synchronization...');
    const sync = exec(`gdrive sync upload ${dstDir} ${GOOGLE_DRIVE_SYNC_FOLDER_ID}`);

    sync.stdout.on('data', (data) => {
        // console.log(data.toString());
    });

    sync.stderr.on('data', (data) => {
        // console.log(data.toString());
    });

    sync.on('error', (e) => {
        console.log('error', e);
    });

    sync.on('exit', (code) => {
        console.log('Synchronized.');
        done();
    });
}

const options = {
    downOpt: ['-f', 'bestaudio/best'],
    infoOpt: ['--flat-playlist'],
    dstDir: path.join(__dirname, 'downloads'),
    tmpDir: path.join(__dirname, 'temp'),
    isCronCall: true
};

exec(`ps -ef | grep "node ${__dirname}"`, (err, result) => {
    const fileName = __filename.substr(0, __filename.lastIndexOf('.'));
    const lines = result.split('\n')
        .filter(value => (value.indexOf('/bin/sh -c') === -1 && value.indexOf(fileName) !== -1));

    if (lines.length <= 1) {
        startProcess(YOUTUBE_PLAYLIST_LINK, options);
    } else {
        console.log(`Another ${fileName} process is already running.`);
    }
});
