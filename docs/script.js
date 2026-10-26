(function () {
  'use strict';
  var C = window.PP || {};

  // Work out the GitHub repo (config value, or detected from username.github.io/repo).
  var repo = C.repo;
  if (!repo || /^YOUR-/.test(repo)) {
    var m = location.hostname.match(/^([^.]+)\.github\.io$/);
    var seg = location.pathname.split('/')[1];
    repo = m && seg ? m[1] + '/' + seg : null;
  }
  var base = repo ? 'https://github.com/' + repo + '/releases/latest/download/' : null;
  var files = {
    win: 'PhotoPicker-Setup.exe',
    mac_arm: 'PhotoPicker-mac-arm64.dmg',
    mac_intel: 'PhotoPicker-mac-x64.dmg'
  };

  // Download buttons
  document.querySelectorAll('[data-dl]').forEach(function (a) {
    var f = files[a.getAttribute('data-dl')];
    if (base && f) a.href = base + f;
  });

  // Hero button matches the visitor's computer
  var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var ua = navigator.userAgent || '';
  var mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  var isMac = !mobile && /mac/i.test(platform);
  var isWin = !mobile && /win/i.test(platform);
  var hero = document.getElementById('heroDl');
  var note = document.getElementById('heroNote');
  if (hero && base) {
    if (isWin) {
      hero.textContent = 'Download for Windows';
      hero.href = base + files.win;
      note.textContent = 'Windows 10 or later. Also available for Mac.';
    } else if (isMac) {
      hero.textContent = 'Download for Mac';
      hero.href = base + files.mac_arm;
      note.innerHTML = 'For Macs with Apple silicon (M1 or later). <a href="#download">Have an Intel Mac, or need Windows?</a>';
    } else if (mobile) {
      note.textContent = 'PhotoPicker is a desktop app. Open this page on your Windows PC or Mac to download it.';
    }
  }

  // Contact details
  document.querySelectorAll('[data-contact]').forEach(function (a) {
    if (C.contact) {
      a.textContent = C.contact;
      a.href = 'mailto:' + C.contact;
    }
  });
  document.querySelectorAll('[data-developer]').forEach(function (el) {
    if (C.developer) el.textContent = C.developer;
  });

  // Early-access notices
  if (C.earlyAccess) {
    document.querySelectorAll('[data-early]').forEach(function (el) { el.hidden = false; });
  }

  // Latest version, if GitHub answers (silently skipped otherwise)
  var info = document.getElementById('releaseInfo');
  if (info && repo && window.fetch) {
    fetch('https://api.github.com/repos/' + repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.tag_name) return;
        var d = j.published_at ? new Date(j.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        info.textContent = 'Version ' + j.tag_name.replace(/^v/, '') + (d ? ', released ' + d : '') + '.';
      })
      .catch(function () {});
  }
})();
