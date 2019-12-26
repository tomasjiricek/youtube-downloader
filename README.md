# youtube-downloader

YouTube downloader dependent on several tools, working in Linux (including Raspberry Pi) only.
**NOTE:** This is just experimental version.

## Dependencies:
**Mandatory:**
- `ffmpeg` (can be just alias of `avconv`)
- `npm` with `node`
- `python`

**Optional:**
- `gdrive` (for synchronizing with your Google Drive) - setup required, see: https://github.com/gdrive-org/gdrive

## Setup
- Copy `secrets.example.json` and rename to `secrets.json`
- `GOOGLE_DRIVE_SYNC_FOLDER_NAME` - if you have `gdrive` installed (see [How to get `gdrive` command](https://github.com/gdrive-org/gdrive)), fill in a folder name you wish to upload to, otherwise **REMOVE** the property from the JSON file
- `YOUTUBE_PLAYLIST_LINK` - paste a link to public playlist you wish to download and convert
- `npm install`

## Run
- `npm start` / `node downloadSync`
