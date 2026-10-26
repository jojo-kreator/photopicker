# Publishing PhotoPicker

Follow these steps in order. When you finish, you will have a public download page, and every time you publish a new version the installers are built for Windows and Mac automatically.

You need: a free GitHub account, the free Google Cloud setup from `README.md`, and about an hour for the first time.

## 1. Create the GitHub repository

1. Sign in at github.com, select **New repository**, name it `photopicker`, choose **Public**, and create it.
   Public is needed for free GitHub Pages and for free build minutes. Your code becomes visible, but your Google credentials file is **never** uploaded (`.gitignore` blocks it).
2. Upload this project. The easiest way is **GitHub Desktop** (desktop.github.com): *File → Add local repository* → pick this folder → *Publish repository* (untick "Keep this code private").
   If you are comfortable with a terminal:
   ```
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/photopicker.git
   git push -u origin main
   ```
3. Check on github.com that the folders `.github`, `docs`, `lib`, `renderer` are there and that `google-credentials.json` is **not**.

## 2. Edit the website settings

Open `docs/config.js` and set your GitHub username in `repo`, your `contact` email (shown in the privacy policy), and your name or studio name in `developer`. Commit and push the change.

## 3. Add your Google credentials as a secret

1. Do the "One-time Google setup" in `README.md` and download the OAuth client JSON.
2. On GitHub: your repository → **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: `GOOGLE_CREDENTIALS_JSON`. Value: paste the **entire contents** of the JSON file. Save.

The build copies this into the installers so photographers never see any of it. (For desktop apps Google treats this client ID and secret as non-confidential, but keep it out of your repository anyway.)

## 4. Turn on the website

Repository → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/docs` → Save.
After a minute or two the site is live at `https://YOUR-USERNAME.github.io/photopicker/`.

## 5. Test the build, then make your first release

1. **Test build (no release yet):** repository → **Actions → Build and release → Run workflow**. After about 10 minutes, open the finished run and download the installers from *Artifacts*. Install one and try it.
2. **First release:** repository → **Releases → Draft a new release** → choose a tag → type `v0.1.0` → *Create new tag on publish* → **Publish release**.
   This starts the build. After about 10 minutes the release page shows three files: `PhotoPicker-Setup.exe`, `PhotoPicker-mac-arm64.dmg`, `PhotoPicker-mac-x64.dmg`.
3. Open your website and press the download button. It always points to the latest release, so you never edit links.

If the build fails, open the run in the **Actions** tab and read the red step. The most common cause is a missing or mis-pasted `GOOGLE_CREDENTIALS_JSON` secret.

## 6. Who can sign in (important)

While your Google app is in **Testing** status:
- Only people you list can sign in. Add them in Google Cloud → **APIs & Services → OAuth consent screen → Test users** (maximum 100). They will see "Google hasn't verified this app" and must choose *Advanced → Go to PhotoPicker*.
- Google signs testers out after 7 days, so they will need to sign in again about once a week. The app tells them when this happens.

This is fine for your first photographers. To remove the limit, you must have Google **verify** the app.

## 7. Before you advertise publicly: Google verification

PhotoPicker uses Google's read-only Drive permission, which Google classes as a *restricted* scope. Verification typically needs:
- A website for the app and a **privacy policy URL**. Both are in this project (`docs/`). Read `docs/privacy.html` and make sure everything in it is true for you. It is a starting draft, not legal advice.
- Proof that you own the website's domain. Google generally cannot verify a `github.io` address, so plan to buy a domain (roughly $10–20 a year) and connect it under *Settings → Pages → Custom domain*.
- A demo video of the sign-in and how the app uses the data.
- For restricted scopes, an independent **security assessment**, which can cost real money and is repeated yearly.

Start this early because reviews take weeks. When verification is approved, set `earlyAccess: false` in `docs/config.js` to hide the early-access notices. If the cost is too high, there are ways to redesign the sign-in to avoid the restricted permission; ask and we can look at them.

## 8. Optional but recommended: remove the security warnings

Without signing, Windows shows "Windows protected your PC" and macOS blocks the first launch. The download page explains how to get past both, which is enough for early users.
- **Mac:** join the Apple Developer Program (about $99 a year) to sign and notarize the app.
- **Windows:** buy a code-signing certificate, or use Microsoft's Azure Trusted Signing.
Once you have either, the workflow can be updated to sign automatically.

## 9. Releasing an update later

1. Fix or add things, change `"version"` in `package.json` (for example to `0.1.1`), commit and push.
2. Create a new release with tag `v0.1.1` (step 5.2).
3. The build runs and the website's download buttons now serve the new version. People install it over the old one.
