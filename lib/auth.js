'use strict';
// Google OAuth for desktop apps: system browser + loopback redirect + PKCE.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function loadCredentials(appDir, userDir) {
  for (const dir of [userDir, appDir]) {
    const p = path.join(dir, 'google-credentials.json');
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const c = j.installed || j.web || j;
      if (c.client_id) return { clientId: c.client_id, clientSecret: c.client_secret || '' };
    }
  }
  throw new Error(
    'google-credentials.json not found. See README.md, "One-time Google setup".'
  );
}

class Auth {
  constructor({ appDir, userDir, openExternal, store }) {
    this.appDir = appDir;
    this.userDir = userDir;
    this.openExternal = openExternal;
    this.store = store; // { read(): string|null, write(string), clear() }
    this.tokens = null;
  }

  _load() {
    if (this.tokens) return this.tokens;
    const raw = this.store.read();
    this.tokens = raw ? JSON.parse(raw) : null;
    return this.tokens;
  }

  isSignedIn() {
    const t = this._load();
    return !!(t && t.refresh_token);
  }

  signOut() {
    this.tokens = null;
    this.store.clear();
  }

  async signIn() {
    const { clientId, clientSecret } = loadCredentials(this.appDir, this.userDir);
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));

    const { code, redirectUri } = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/') {
          res.writeHead(404).end();
          return;
        }
        const ok = u.searchParams.get('code') && u.searchParams.get('state') === state;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<body style="font-family:sans-serif;text-align:center;padding-top:80px">
           <h2>${ok ? 'Signed in ✔' : 'Sign-in failed'}</h2>
           <p>You can close this tab and return to PhotoPicker.</p></body>`
        );
        server.close();
        clearTimeout(timer);
        if (ok) resolve({ code: u.searchParams.get('code'), redirectUri });
        else reject(new Error(u.searchParams.get('error') || 'Sign-in was cancelled.'));
      });
      let redirectUri;
      const timer = setTimeout(() => {
        server.close();
        reject(new Error('Sign-in timed out. Please try again.'));
      }, 5 * 60 * 1000);
      server.listen(0, '127.0.0.1', () => {
        redirectUri = `http://127.0.0.1:${server.address().port}`;
        const url = new URL(AUTH_URL);
        url.search = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPE,
          access_type: 'offline',
          prompt: 'consent',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
        }).toString();
        this.openExternal(url.toString());
      });
    });

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    const tokens = await this._tokenRequest(body);
    tokens.expires_at = Date.now() + tokens.expires_in * 1000;
    this.tokens = tokens;
    this.store.write(JSON.stringify(tokens));
  }

  async _tokenRequest(body) {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || 'Google sign-in failed');
    return j;
  }

  async getAccessToken() {
    const t = this._load();
    if (!t || !t.refresh_token) throw new Error('Not signed in');
    if (t.access_token && t.expires_at - Date.now() > 60 * 1000) return t.access_token;
    const { clientId, clientSecret } = loadCredentials(this.appDir, this.userDir);
    const body = new URLSearchParams({
      client_id: clientId,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    let fresh;
    try {
      fresh = await this._tokenRequest(body);
    } catch (e) {
      this.signOut();
      throw new Error('Your Google session expired. Please sign in again.');
    }
    this.tokens = {
      ...t,
      access_token: fresh.access_token,
      expires_at: Date.now() + fresh.expires_in * 1000,
    };
    this.store.write(JSON.stringify(this.tokens));
    return this.tokens.access_token;
  }
}

module.exports = { Auth };
