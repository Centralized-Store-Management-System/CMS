# CMS Instant Deployment Engine

## What this changes
- Back Office and Owner Console check `deploy-version.json` every 15 seconds while visible, and on focus/return-online.
- PWA registrations bypass the browser HTTP cache for service-worker update checks; worker update checks run at startup, on foreground return, and every 60 seconds.
- New service worker activates immediately and retains two previous app caches as offline fallback.
- The app waits for active writes, open sheets/dialogs, and focused form controls before reloading.
- If an update is waiting while the user is editing, a visible update bar lets the user apply it after saving/closing the active work.
- Version marker is shared across the two same-origin app entry points.

## Release procedure
1. Merge the approved code change into the production branch.
2. Update `deploy-version.json` with a new unique `version` value for every production release.
3. Confirm the static host has published `index.html`, `owner.html`, `sw.js`, `js/deploy-sync.js`, and `deploy-version.json`.
4. Verify `deploy-version.json` responds with the new version and is not served stale by the hosting/CDN layer.
5. Test one existing Back Office tab and one Owner tab on iPhone/iPad/desktop. Confirm safe update while idle and deferral while a form/save is active.

## Recommended HTTP cache headers
Configure these at the static hosting/CDN layer (not controlled by this repository's JavaScript):
- HTML entry points and `deploy-version.json`: `Cache-Control: no-cache, must-revalidate`
- `sw.js`: `Cache-Control: no-cache, must-revalidate`
- Versioned JS/CSS assets: `Cache-Control: public, max-age=31536000, immutable` only when filenames/URLs are content-versioned.
- API responses and authenticated data: do not place in the static asset cache.

## Limits / safety
- A device cannot update before the new deployment is publicly available from its hosting/CDN edge.
- Detection is typically within the 15-second polling interval for an open, foreground tab; service-worker checks are at most about 60 seconds apart. Network, browser suspension, and CDN propagation can extend this.
- The app does not force reload while an observed write or editing surface is active. A user may need to close a form or press the update button.
- This rollout covers the Back Office and Owner entry points in this repository. Any separately hosted Staff/Manager/LIFF clients need their own update integration.
- This does not deploy Supabase Edge Functions or database migrations; backend releases remain a separate coordinated step.
