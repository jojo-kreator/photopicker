'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseNames, matchNames } = require('../lib/matcher');

const files = [
  { id: '1', name: 'IMG_0452.JPG', path: 'IMG_0452.JPG' },
  { id: '2', name: 'IMG_0452.CR2', path: 'IMG_0452.CR2' },
  { id: '3', name: 'IMG_0453.JPG', path: 'IMG_0453.JPG' },
  { id: '4', name: 'DSC_0007.ARW', path: 'DSC_0007.ARW' },
  { id: '5', name: 'wedding final.jpg', path: 'wedding final.jpg' },
];

test('parseNames handles commas, newlines, spaces, quotes and duplicates', () => {
  const out = parseNames('IMG_0452, "IMG_0453"\nimg_0452;  DSC_0007.ARW \n\n');
  assert.deepStrictEqual(out, ['IMG_0452', 'IMG_0453', 'DSC_0007.ARW']);
});

test('name without extension brings every version (JPG + RAW)', () => {
  const r = matchNames(files, ['IMG_0452']);
  assert.strictEqual(r.found.length, 1);
  assert.strictEqual(r.found[0].files.length, 2);
  assert.strictEqual(r.ambiguous.length, 1);
});

test('name with extension matches only that file, case-insensitive', () => {
  const r = matchNames(files, ['img_0452.cr2']);
  assert.strictEqual(r.found[0].files.length, 1);
  assert.strictEqual(r.found[0].files[0].id, '2');
  assert.strictEqual(r.found[0].matchedBy, 'exact');
});

test('requested .jpg falls back to all versions if that exact file is absent', () => {
  const r = matchNames(files, ['DSC_0007.jpg']);
  assert.strictEqual(r.found.length, 1);
  assert.strictEqual(r.found[0].files[0].id, '4');
});

test('digits-only matches by trailing number', () => {
  const r = matchNames(files, ['453', '0007']);
  assert.strictEqual(r.found.length, 2);
  assert.strictEqual(r.found[0].matchedBy, 'number');
});

test('missing names are reported', () => {
  const r = matchNames(files, ['IMG_9999', 'IMG_0453']);
  assert.strictEqual(r.missing.length, 1);
  assert.strictEqual(r.missing[0].query, 'IMG_9999');
  assert.strictEqual(r.found.length, 1);
});
