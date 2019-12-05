# youtube-downloader

YouTube downloader dependent on several tools, working in Linux (including Raspberry Pi) only.
**NOTE:** This is just experimental version.

## Dependencies:
- `gdrive` (for synchronizing with your Google Drive) - setup required, see: https://github.com/gdrive-org/gdrive
- `ffmpeg` (can be just alias of `avconv`)
- `npm` with `node`

## Setup
- Copy `secrets.example.json` and rename to `secrets.json`
- If you have `gdrive` installed, fill in a correct [folder ID](#google-drive-folder-id), otherwise **remove** `GOOGLE_DRIVE_SYNC_FOLDER_ID` from `secrets.json`
- Put a link to public playlist you wish to download (and convert)
- `npm install`

### Google Drive folder ID
To get ID of the folder you want to sync to, see:
https://ploi.io/documentation/mysql/where-do-i-get-google-drive-folder-id

## Run
- `npm start`
