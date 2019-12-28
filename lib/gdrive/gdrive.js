const exec = require('child_process').exec;
const ERROR = require('./error.constants.json');
const { logWithTime } = require('../logger');

// Configuration for Google Drive

const DEFAULT_SEARCH_QUERY = `trashed = false and 'me' in owners`;
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function getFolderId(name) {
    return new Promise((resolve, reject) => {
        const command = `gdrive list \
            --max 2 \
            --no-header \
            --query "${DEFAULT_SEARCH_QUERY} and mimeType = '${FOLDER_MIME_TYPE}' and name = '${name}'"`;

        const proc = exec(command);
        let data = '';

        proc.stdout.on('data', (chunk) => {
            data += chunk;
        });

        proc.stderr.on('data', (data) => {
            reject(new Error(data));
        });

        proc.on('exit', (code) => {
            if (data.length === 0) {
                reject(ERROR.FOLDER_NOT_FOUND);
            } else {
                let lines = data.split(/\r\n|\n|\r/).filter((line) => (line.length > 0));

                if (lines.length > 1) {
                    reject(ERROR.FOLDER_NOT_UNIQUE);
                    return;
                }

                const folderId = lines[0].substring(0, lines[0].indexOf(' '));

                if (folderId !== null && folderId.length > 0) {
                    resolve(folderId);
                } else {
                    reject(ERROR.INVALID_OUTPUT_DATA);
                }
            }
        });
    });
}

function createFolder(name) {
    return new Promise((resolve, reject) => {
        const command = `gdrive mkdir "${name}"`;

        const proc = exec(command);
        let data = '';

        proc.stdout.on('data', (chunk) => {
            data += chunk;
        });

        proc.stderr.on('data', (data) => {
            reject(data);
        });

        proc.on('exit', (code) => {
            if (data.length === 0) {
                reject(ERROR.UNKNOWN_ERROR);
                return;
            }

            let lines = data.split(/\r\n|\n|\r/).filter((line) => (line.length > 0));
            const folderId = lines[0].substring(lines.indexOf(' ') + 1, lines[0].indexOf(' created'));

            if (folderId !== null && folderId.length > 0) {
                resolve(folderId);
            } else {
                reject(ERROR.INVALID_OUTPUT_DATA);
            }
        });
    });
}

async function synchronize(source, driveFolderName, done) {
    logWithTime('Started synchronization...');

    let driveFolderId;

    try {
        driveFolderId = await getFolderId(driveFolderName);
    } catch (errorGetFolder) {
        if (errorGetFolder === ERROR.FOLDER_NOT_FOUND) {
            try {
                driveFolderId = await createFolder(driveFolderName);
            } catch (e) {
                logWithTime('ERROR:', e);
                done(e);
                return;
            }
        } else {
            logWithTime('ERROR:', errorGetFolder);
            done(errorGetFolder);
            return;
        }
    }
    
    const proc = exec(`gdrive sync upload ${source} ${driveFolderId}`);

    proc.on('exit', (code) => {
        logWithTime('Synchronized.');
        done();
    });
}

module.exports = {
    createFolder,
    getFolderId,
    synchronize
};
