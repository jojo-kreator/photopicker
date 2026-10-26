'use strict';
const $ = (id) => document.getElementById(id);
let lastScan = null;
let lastDest = null;

function show(el, on) { el.classList.toggle('hidden', !on); }
function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1e3)) + ' KB';
}

async function refreshAuth() {
  const r = await window.api.authStatus();
  const signedIn = r.ok && r.data.signedIn;
  show($('signin'), !signedIn);
  show($('app'), signedIn);
  show($('signOutBtn'), signedIn);
  $('accountText').textContent = signedIn ? 'Google Drive connected' : '';
}

$('signInBtn').onclick = async () => {
  $('signInError').textContent = '';
  $('signInBtn').disabled = true;
  $('signInBtn').textContent = 'Waiting for your browser…';
  const r = await window.api.signIn();
  $('signInBtn').disabled = false;
  $('signInBtn').textContent = 'Sign in with Google';
  if (!r.ok) $('signInError').textContent = r.error;
  refreshAuth();
};
$('signOutBtn').onclick = async () => { await window.api.signOut(); resetResults(); refreshAuth(); };

function resetResults() {
  lastScan = null;
  show($('results'), false);
  show($('empty'), true);
}

$('clearBtn').onclick = () => {
  $('names').value = '';
  $('error').textContent = '';
  $('scanStatus').textContent = '';
  resetResults();
};

window.api.onScanProgress((n) => { $('scanStatus').textContent = `Reading folder… ${n} files so far`; });

$('findBtn').onclick = async () => {
  $('error').textContent = '';
  $('scanStatus').textContent = 'Reading folder…';
  show($('doneBox'), false);
  show($('progress'), false);
  $('findBtn').disabled = true;
  const r = await window.api.scan({ folder: $('folder').value, names: $('names').value });
  $('findBtn').disabled = false;
  if (!r.ok) {
    $('scanStatus').textContent = '';
    $('error').textContent = r.error;
    if (/sign in again/i.test(r.error)) refreshAuth();
    return;
  }
  lastScan = r.data;
  let status = `Folder has ${r.data.totalInFolder} files.`;
  if (r.data.missingCount > 0 && r.data.sample && r.data.sample.length) {
    status += ` Examples: ${r.data.sample.join(', ')}`;
  }
  $('scanStatus').textContent = status;
  renderResults(r.data);
};

function renderResults(d) {
  show($('empty'), false);
  show($('results'), true);
  $('sFound').textContent = d.foundCount;
  $('sFiles').textContent = d.fileCount;
  $('sMissing').textContent = d.missingCount;

  const found = $('foundList');
  const missing = $('missingList');
  found.replaceChildren();
  missing.replaceChildren();

  for (const r of d.results) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = r.query;
    if (r.status === 'found') {
      if (r.matchedBy === 'number' || r.matchedBy === 'partial') {
        const t = document.createElement('span');
        t.className = 'tag';
        t.textContent = r.matchedBy === 'number' ? 'matched by number' : 'partial match, check';
        left.appendChild(t);
      }
      const right = document.createElement('span');
      right.className = 'files';
      right.textContent = r.files.map((f) => f.name).join(', ');
      li.append(left, right);
      found.appendChild(li);
    } else {
      li.append(left);
      missing.appendChild(li);
    }
  }
  if (!d.foundCount) found.innerHTML = '';
  show($('copyMissingBtn'), d.missingCount > 0);
  $('downloadBtn').disabled = d.fileCount === 0;
  $('downloadBtn').textContent = `Download all (${d.fileCount})`;
  setTab('found');
}

function setTab(name) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  show($('foundList'), name === 'found');
  show($('missingList'), name === 'missing');
}
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

$('copyMissingBtn').onclick = async () => {
  if (!lastScan) return;
  const text = lastScan.results.filter((r) => r.status === 'missing').map((r) => r.query).join('\n');
  await navigator.clipboard.writeText(text);
  $('copyMissingBtn').textContent = 'Copied ✔';
  setTimeout(() => ($('copyMissingBtn').textContent = 'Copy missing names'), 1500);
};

$('downloadBtn').onclick = async () => {
  if (!lastScan) return;
  const dest = await window.api.pickFolder();
  if (!dest.ok || !dest.data) return;
  lastDest = dest.data;

  // de-duplicate files that were matched by more than one name
  const map = new Map();
  for (const r of lastScan.results) for (const f of r.files) map.set(f.id, f);
  const files = [...map.values()];

  show($('doneBox'), false);
  show($('progress'), true);
  $('barFill').style.width = '0%';
  $('downloadBtn').disabled = true;
  const res = await window.api.download({ files, destDir: dest.data });
  $('downloadBtn').disabled = false;
  show($('progress'), false);

  const box = $('doneBox');
  box.classList.remove('bad');
  show(box, true);
  if (!res.ok) {
    box.classList.add('bad');
    $('doneText').textContent = res.error;
    return;
  }
  const d = res.data;
  if (d.cancelled) {
    box.classList.add('bad');
    $('doneText').textContent = `Cancelled after ${d.done} of ${d.total} files.`;
  } else if (d.failed.length) {
    box.classList.add('bad');
    $('doneText').textContent = `${d.total - d.failed.length} downloaded, ${d.failed.length} failed (${d.failed.slice(0, 3).map((f) => f.name).join(', ')}${d.failed.length > 3 ? '…' : ''}). Click Download all to retry; finished files are skipped.`;
  } else {
    $('doneText').textContent = `All ${d.total} files saved ✔`;
  }
};

window.api.onDownloadProgress((p) => {
  const pct = p.totalBytes ? (p.bytes / p.totalBytes) * 100 : (p.done / p.total) * 100;
  $('barFill').style.width = Math.min(100, pct).toFixed(1) + '%';
  $('progText').textContent = `${p.done} / ${p.total} files · ${fmtBytes(p.bytes)} of ${fmtBytes(p.totalBytes)}`;
});

$('cancelBtn').onclick = () => window.api.cancel();
$('openBtn').onclick = () => lastDest && window.api.openFolder(lastDest);

refreshAuth();
