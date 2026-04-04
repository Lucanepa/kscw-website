# Instagram Feed Widget — Design Spec

## Problem

Instagram deprecated profile embeds via `embed.js` — it only works for individual post URLs, not profile pages. The team pages showed a broken white box.

## Solution

Use Instagram's native `/embed/` iframe URL (`https://www.instagram.com/{handle}/embed/`), which renders a full profile widget with avatar, follower count, and photo grid — identical to what ClubDesk used.

Gated behind a GDPR consent placeholder since the iframe loads Instagram resources directly in the browser.

## Implementation

### Frontend (`public/js/team-page.js`)

`renderInstagramEmbed(teamData)`:
1. Extract handle from `teamData.social_url`
2. Show consent placeholder with Instagram logo, handle, privacy notice, and "Load" button
3. On click: replace placeholder with `<iframe src="https://www.instagram.com/{handle}/embed/">`
4. Alternative "Open on Instagram" link always visible

### CSS (`src/styles/global.css`)

- `.ig-consent` — consent placeholder card
- `.ig-feed-iframe` — iframe sizing (480×560, responsive)

### CSP (`public/_headers`)

- `frame-src` includes `https://www.instagram.com`

## Privacy

- Instagram iframe loads only after explicit user consent (click)
- Privacy policy already mentions Instagram in third-party services section
- No Instagram scripts loaded without consent

## No Backend Changes

No Directus endpoint needed — this is purely frontend.
