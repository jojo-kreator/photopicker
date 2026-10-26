'use strict';
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

function extractFolderId(input) {
  const s = String(input || '').trim();
  let m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;
  return null;
}

async function api(auth, url, opts = {}, attempt = 0) {
  const token = await auth.getAccessToken();
  const r = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) {
    await new Promise((res) => setTimeout(res, 800 * 2 ** attempt));
    return api(auth, url, opts, attempt + 1);
  }
  if (!r.ok) {
    let msg = `Google Drive error ${r.status}`;
    try {
      const j = await r.json();
      if (j.error && j.error.message) msg = j.error.message;
    } catch (_) {}
    if (r.status === 404) msg = 'Folder not found, or your Google account cannot open it.';
    const e = new Error(msg);
    e.status = r.status;
    throw e;
  }
  return r;
}

// Recursively list every non-folder file under a folder.
async function listFolder(auth, rootId, onProgress = () => {}) {
  const files = [];
  const queue = [{ id: rootId, rel: '' }];
  while (queue.length) {
    const { id, rel } = queue.shift();
    let pageToken;
    do {
      const params = new URLSearchParams({
        q: `'${id}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id,name,mimeType,size,shortcutDetails)',
        pageSize: '1000',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const r = await api(auth, `${API}/files?${params}`);
      const j = await r.json();
      for (const f of j.files || []) {
        if (f.mimeType === FOLDER) {
          queue.push({ id: f.id, rel: rel ? `${rel}/${f.name}` : f.name });
        } else if (f.mimeType.startsWith('application/vnd.google-apps.')) {
          continue; // Docs/Sheets etc. are not photos
        } else {
          files.push({
            id: f.id,
            name: f.name,
            size: Number(f.size || 0),
            path: rel ? `${rel}/${f.name}` : f.name,
          });
        }
      }
      pageToken = j.nextPageToken;
      onProgress(files.length);
    } while (pageToken);
  }
  return files;
}

function safeName(n) {
  return n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

async function downloadOne(auth, file, destPath, onBytes, signal) {
  if (fs.existsSync(destPath) && file.size && fs.statSync(destPath).size === file.size) {
    onBytes(file.size);
    return 'skipped';
  }
  const url = `${API}/files/${file.id}?alt=media&supportsAllDrives=true&acknowledgeAbuse=false`;
  const r = await api(auth, url, { signal });
  const tmp = destPath + '.part';
  let counted = 0;
  const src = Readable.fromWeb(r.body);
  src.on('data', (chunk) => {
    counted += chunk.length;
    onBytes(chunk.length);
  });
  try {
    await pipeline(src, fs.createWriteStream(tmp));
    fs.renameSync(tmp, destPath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw Object.assign(e, { counted });
  }
  return 'downloaded';
}

/**
 * files: [{id,name,size,path}]. Downloads into destDir (flat). If two files share a
 * name, the later ones get their folder prefixed so nothing is overwritten.
 */
async function downloadAll(auth, files, destDir, { concurrency = 4, onProgress, signal } = {}) {
  fs.mkdirSync(destDir, { recursive: true });
  const used = new Set();
  const jobs = files.map((f) => {
    let name = safeName(f.name);
    if (used.has(name.toLowerCase())) {
      name = safeName(f.path.replace(/\//g, ' - '));
    }
    let n = 1;
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    while (used.has(name.toLowerCase())) name = `${stem} (${n++})${ext}`;
    used.add(name.toLowerCase());
    return { file: f, dest: path.join(destDir, name) };
  });

  const total = jobs.length;
  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  let done = 0, failed = [], bytes = 0, next = 0;

  const emit = (current) =>
    onProgress && onProgress({ done, total, failed: failed.length, bytes, totalBytes, current });

  async function worker() {
    while (next < jobs.length && !(signal && signal.aborted)) {
      const job = jobs[next++];
      emit(job.file.name);
      try {
        await downloadOne(auth, job.file, job.dest, (b) => { bytes += b; }, signal);
      } catch (e) {
        if (signal && signal.aborted) return;
        failed.push({ name: job.file.name, error: e.message });
      }
      done++;
      emit(job.file.name);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return { done, total, failed, cancelled: !!(signal && signal.aborted), destDir };
}

module.exports = { extractFolderId, listFolder, downloadAll };
