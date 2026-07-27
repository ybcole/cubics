# Cubics Companion

Browser extension that strips frame-blocking headers so external websites load inside Cubics canvas widgets.

## Setup

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `cubics-companion` folder
4. In Chrome settings, go to `chrome://settings/cookies`
5. Set **Third-party cookies** → **Allow third-party cookies** (required for Google sign-in to carry over into iframes)

## What it does

- **Strips response headers** (`X-Frame-Options`, `Content-Security-Policy`) so sites allow being framed
- **Sets `Sec-Fetch-Site: none`** on iframe requests so servers treat them as direct navigations (avoids 403 errors from Google, etc.)
- **Reports URL changes** from inside iframes back to the parent page
- **Detects cookie errors** and shows a helpful overlay when Chrome is blocking cookies

## Required permissions

- `declarativeNetRequest` — modify request/response headers
- `tabs` — report iframe URLs to the parent page
- `storage` — persist extension state

## Troubleshooting

### "Cookies blocked" overlay appears

Open `chrome://settings/cookies` → set to **Allow third-party cookies**.

### Site still shows 403

Make sure the extension is enabled and has the correct permissions. Remove and re-add if needed.
