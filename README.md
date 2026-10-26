# PhotoPicker

Paste the file names your client selected, point the app at the Google Drive shoot folder, and PhotoPicker finds every matching file (JPEG and RAW) and downloads them all into one folder.

## Run it

1. Install Node.js 20+ from nodejs.org.
2. In this folder: `npm install` then `npm start`.
3. Do the one-time Google setup below (needed before sign-in works).

## One-time Google setup (about 10 minutes)

PhotoPicker reads Drive through Google's official API, so it needs an "OAuth client" that belongs to you, the app's publisher.

1. Go to https://console.cloud.google.com and create a project (e.g. "PhotoPicker").
2. **APIs & Services → Library** → search "Google Drive API" → **Enable**.
3. **APIs & Services → OAuth consent screen** → choose **External**, fill in app name and your email. Add the scope `.../auth/drive.readonly`. While the app is in "Testing", add each photographer's Gmail under **Test users** (limit 100).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type **Desktop app**.
5. Download the JSON and save it as `google-credentials.json` in this folder (next to `main.js`).

## How it works

- Sign in once; the token is stored encrypted on the photographer's computer (OS keychain via Electron `safeStorage`).
- Paste the folder link, paste the names (commas, spaces or new lines), click **Find files**.
- Names without an extension fetch every version (e.g. `IMG_0452.JPG` and `IMG_0452.CR2`). Names with an extension fetch only that file. A bare number such as `0452` matches `IMG_0452` (flagged "matched by number").
- **Not found** tab lists names with no match, with a button to copy them back to send to the client.
- **Download all** saves everything into a folder you pick (4 files at a time, subfolders searched too). Re-running skips files already saved, so an interrupted download can be resumed.

## Build installers and publish

To put it online for people to download (automatic Windows + Mac builds, download page, privacy page), follow **PUBLISHING.md**.

To build just on your own computer: `npm run dist:win` (on Windows) or `npm run dist:mac` (on a Mac). Installers appear in `dist/`.

## Before offering it to other photographers

`drive.readonly` is a Google "restricted" scope. While your OAuth app is in Testing mode, only the Gmail addresses you list (max 100) can sign in, and sign-in shows an "unverified app" warning. To open it to everyone, submit the app for Google verification (privacy policy URL and a security assessment are required for restricted scopes). Plan for this before a public launch.

## Tests

`npm test` runs the matcher and Drive-layer tests (Drive is simulated; no network needed).
