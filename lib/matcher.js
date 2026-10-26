'use strict';

// Split pasted text into a clean, de-duplicated list of requested names.
function parseNames(text) {
  const seen = new Set();
  const out = [];
  for (let raw of String(text || '').split(/[\s,;]+/)) {
    let n = raw.trim().replace(/^["'`(\[]+|["'`)\].]+$/g, '');
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function splitExt(name) {
  const i = name.lastIndexOf('.');
  // treat as extension only if short and alphanumeric (e.g. .jpg, .CR2, .arw)
  if (i > 0 && /^[A-Za-z0-9]{2,5}$/.test(name.slice(i + 1))) {
    return { base: name.slice(0, i), ext: name.slice(i + 1) };
  }
  return { base: name, ext: '' };
}

function trailingDigits(base) {
  const m = base.match(/(\d+)$/);
  return m ? String(parseInt(m[1], 10)) : null;
}

/**
 * files: [{ id, name, size, path }]
 * names: string[] from parseNames
 * Returns { results: [{ query, status, matchedBy, files: [] }], found, missing, ambiguous }
 *  status: 'found' | 'missing'
 *  matchedBy: 'exact' | 'name' | 'number'
 */
function matchNames(files, names) {
  const byFull = new Map(); // "img_0452.cr2" -> [files]
  const byBase = new Map(); // "img_0452"     -> [files]
  const byNumber = new Map(); // "452"        -> [files]

  const push = (map, key, f) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  };

  for (const f of files) {
    const { base } = splitExt(f.name);
    push(byFull, f.name.toLowerCase(), f);
    push(byBase, base.toLowerCase(), f);
    const d = trailingDigits(base);
    if (d !== null) push(byNumber, d, f);
  }

  const results = [];
  for (const query of names) {
    const q = query.toLowerCase();
    const { base, ext } = splitExt(query);
    let hit = null;
    let matchedBy = null;

    if (ext && byFull.has(q)) {
      hit = byFull.get(q);
      matchedBy = 'exact';
    } else if (byBase.has((ext ? base : query).toLowerCase())) {
      // no extension given (or extension not found): bring every version (JPG + RAW)
      hit = byBase.get((ext ? base : query).toLowerCase());
      matchedBy = 'name';
    } else if (/^\d+$/.test(query)) {
      const key = String(parseInt(query, 10));
      if (byNumber.has(key)) {
        hit = byNumber.get(key);
        matchedBy = 'number';
      }
    }

    results.push({
      query,
      status: hit ? 'found' : 'missing',
      matchedBy,
      files: hit || [],
    });
  }

  const found = results.filter((r) => r.status === 'found');
  const missing = results.filter((r) => r.status === 'missing');
  const ambiguous = found.filter((r) => r.files.length > 1);
  return { results, found, missing, ambiguous };
}

module.exports = { parseNames, matchNames, splitExt };
