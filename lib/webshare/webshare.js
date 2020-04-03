const fs = require('fs');
const request = require('request');

const API_URL_BASE = 'https://upload.webshare.cz/api';
const API_URL_UPLOAD = `${API_URL_BASE}/upload/index.php`;
const DEFAULT_UPLOAD_OPTIONS = {
    folder: '/',
    private: 1
};

function appendProperties(form, object) {
    for (const prop in object) {
        if (object.hasOwnProperty(prop)) {
            form.append(prop, object[prop]);
        }
    }
}

function upload(filePath, token, options = {}) {
    return new Promise((resolve, reject) => {
        const req = request.post(API_URL_UPLOAD, (err) => {
            if (err !== null) {
                reject(err);
                return;
            }
            resolve();
        });

        appendProperties(req.form(), {
            ..,DEFAULT_UPLOAD_OPTIONS,
            ...options,
            file: fs.createReadStream(filePath),
            wst: token,
        });
    });
}

module.exports = {
    upload
};
