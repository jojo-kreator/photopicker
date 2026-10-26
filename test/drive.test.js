'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractFolderId, listFolder, downloadAll } = require('../lib/drive');

test('extractFolderId handles common link shapes', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  assert.strictEqual(extractFolderId(`https://drive.google.com/drive/folders/${id}?usp=sharing`), id);
  assert.strictEqual(extractFolderId(`https://drive.google.com/drive/u/0/folders/${id}`), id);
  assert.strictEqual(extractFolderId(`https://drive.google.com/open?id=${id}`), id);
  assert.strictEqual(extractFolderId(id), id);
  assert.strictEqual(extractFolderId('hello'), null);
});

// Fake Drive: root has 2 files + subfolder "RAW" with 1 file, listed over 2 pages.
function installFakeFetch() {
  const real = global.fetch;
  global.fetch = async (url, opts) => {
    const u = new URL(url);
    if (u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q');
      const page = u.searchParams.get('pageToken');
      let files = [];
      let next;
      if (q.includes("'root1'")) {
        if (!page) {
          files = [
            { id: 'a', name: 'IMG_1.JPG', mimeType: 'image/jpeg', size: '5' },
            { id: 'f', name: 'RAW', mimeType: 'application/vnd.google-apps.folder' },
          ];
          next = 'p2';
        } else {
          files = [
            { id: 'b', name: 'IMG_2.JPG', mimeType: 'image/jpeg', size: '5' },
            { id: 'd', name: 'notes', mimeType: 'application/vnd.google-apps.document' },
          ];
        }
      } else if (q.includes("'f'")) {
        files = [{ id: 'c', name: 'IMG_1.JPG', mimeType: 'image/jpeg', size: '5' }];
      }
      return new Response(JSON.stringify({ files, nextPageToken: next }), { status: 200 });
    }
    const m = u.pathname.match(/\/drive\/v3\/files\/(\w+)$/);
    if (m && u.searchParams.get('alt') === 'media') {
      return new Response('hello', { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  return () => (global.fetch = real);
}

const auth = { getAccessToken: async () => 'tok' };

test('listFolder recurses, pages, and skips Google Docs', async () => {
  const restore = installFakeFetch();
  try {
    const files = await listFolder(auth, 'root1');
    assert.deepStrictEqual(files.map((f) => f.path).sort(), ['IMG_1.JPG', 'IMG_2.JPG', 'RAW/IMG_1.JPG']);
  } finally { restore(); }
});

test('downloadAll saves files, keeps same-named files apart, skips on rerun', async () => {
  const restore = installFakeFetch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));
  try {
    const files = await listFolder(auth, 'root1');
    const r1 = await downloadAll(auth, files, dir, { concurrency: 2 });
    assert.strictEqual(r1.failed.length, 0);
    const saved = fs.readdirSync(dir).sort();
    assert.strictEqual(saved.length, 3);
    assert.ok(saved.includes('IMG_1.JPG'));
    assert.ok(saved.includes('RAW - IMG_1.JPG'));
    assert.strictEqual(fs.readFileSync(path.join(dir, 'IMG_2.JPG'), 'utf8'), 'hello');
    assert.ok(!saved.some((n) => n.endsWith('.part')));
    const r2 = await downloadAll(auth, files, dir);
    assert.strictEqual(r2.done, 3);
  } finally {
    restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
