# Liquid Planner browser extension — automatic DARS import

Once installed, the student never copy/pastes again: they sign into Liquid Planner once, then opening their MyPlan DARS audit syncs it automatically. The extension reads the DARS page and sends it to your backend using the same session the web app already has.

## How it works (no codes, no pasting)

- A content script on the **Liquid Planner** site reads the session token the app stores in `localStorage` and hands it (plus your API URL) to the extension.
- A content script on **myplan.uw.edu/audit** reads the rendered audit and the extension POSTs it to `POST /api/import/dars` (authenticated). Your snapshot updates; every device sees it.

## Installing — the honest options

Chrome only allows a true **one-click install with no settings** for extensions that are **published on the Chrome Web Store**. An *unpacked* (unpublished) extension always requires flipping the "Developer mode" switch once — that's a Chrome rule, not ours.

### Option A — For your users: publish to the Chrome Web Store (one click for them)
1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time $5 registration.
2. Upload `liquid-planner-extension.zip` (provided), fill in the listing, submit. Review is usually 1–3 days.
3. After approval, share the store link. Your users click **"Add to Chrome"** — that's it, zero settings.

This is the only path that needs **no developer mode** for end users.

### Option B — To try it yourself right now (3 steps, ~30 seconds)
1. Unzip `liquid-planner-extension.zip` to a folder.
2. Open **chrome://extensions**, and turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and pick the unzipped folder.

Then pin the icon, open Liquid Planner and sign in once, and visit your DARS audit — you'll see a "✓ Synced" toast. The popup has a **Sync now** button too.

## Configure for your deployment

The extension matches the app on `*.vercel.app` and `localhost` out of the box. If you use a **custom domain**, add it to two spots in `extension/manifest.json` (the `content_scripts` matches for the app) and re-zip. The API URL is read automatically from the app, so there's nothing to hardcode.

## Files

`manifest.json` (MV3) · `background.js` (auth + import fetch) · `content-app.js` (grabs session from the app) · `content-dars.js` (scrapes DARS, shows toast) · `popup.html/js` · icons.
