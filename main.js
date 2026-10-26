'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { Auth } = require('./lib/auth');
const { extractFolderId, listFolder, downloadAll } = require('./lib/drive');
const { parseNames, matchNames } = require('./lib/matcher');

let win;
let abort = null;
let cachedFolderId = null;
let cachedFiles = null;

const tokenFile = () => path.join(app.getPath('userData'), 'session.bin');
const store = {
  read() {
    try {
      const buf = fs.readFileSync(tokenFile());
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
    } catch (_) { return null; }
  },
  write(s) {
    const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s);
    fs.writeFileSync(tokenFile(), data);
  },
  clear() { try { fs.unlinkSync(tokenFile()); } catch (_) {} },
};

const auth = new Auth({
  appDir: __dirname,
  userDir: app.getPath('userData'),
  openExternal: (u) => shell.openExternal(u),
  store,
});

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 880,
    minHeight: 620,
    title: 'PhotoPicker',
    backgroundColor: '#14161a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

   const wrap = (fn) => async (_event, ...a) => {
  try { return { ok: true, data: await fn(...a) }; }
  catch (e) { return { ok: false, error: e.message || String(e) }; }
};

ipcMain.handle('auth:status', wrap(async () => ({ signedIn: auth.isSignedIn() })));
ipcMain.handle('auth:signIn', wrap(async () => { await auth.signIn(); return { signedIn: true }; }));
ipcMain.handle('auth:signOut', wrap(async () => { auth.signOut(); cachedFiles = null; cachedFolderId = null; return { signedIn: false }; }));

ipcMain.handle('scan', wrap(async ({ folder, names, refresh }) => {
  const id = extractFolderId(folder);
  if (!id) throw new Error('That does not look like a Google Drive folder link.');
  const list = parseNames(names);
  if (!list.length) throw new Error('Paste at least one file name.');
  if (refresh || cachedFolderId !== id || !cachedFiles) {
    cachedFiles = await listFolder(auth, id, (n) => win && win.webContents.send('scan:progress', n));
    cachedFolderId = id;
  }
  const m = matchNames(cachedFiles, list);
  return {
    totalInFolder: cachedFiles.length,
    requested: list.length,
    results: m.results,
    foundCount: m.found.length,
    missingCount: m.missing.length,
    fileCount: m.found.reduce((a, r) => a + r.files.length, 0),
  };
}));

ipcMain.handle('pickFolder', wrap(async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Where should the selected photos be saved?',
    properties: ['openDirectory', 'createDirectory'],
  });
  return r.canceled ? null : r.filePaths[0];
}));

ipcMain.handle('download', wrap(async ({ files, destDir }) => {
  abort = new AbortController();
  try {
    return await downloadAll(auth, files, destDir, {
      signal: abort.signal,
      onProgress: (p) => win && win.webContents.send('download:progress', p),
    });
  } finally { abort = null; }
}));

ipcMain.handle('cancel', wrap(async () => { if (abort) abort.abort(); return true; }));
   ipcMain.handle('openFolder', wrap(async (p) => { await shell.openPath(p); return true; }));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
