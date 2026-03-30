# KSCW Website: PocketBase → Directus Migration

**Date:** 2026-03-30
**Status:** Approved
**Scope:** Migrate kscw-website from PocketBase API to Directus, aligning with wiedisync platform patterns.

## Context

The KSCW platform (wiedisync) completed its PocketBase → Directus migration in v3.0.0 (2026-03-29). The kscw-website (Astro static site) still fetches from PocketBase at `api.kscw.ch`. This migration aligns the website with the same Directus backend, reuses existing custom endpoints, and eliminates all PocketBase dependencies.

**Key constraints:**
- Astro static site with vanilla JS (no React, no TanStack Query)
- No `@directus/sdk` — thin fetch wrapper only (Option B)
- Break up monolithic `data.js` into per-page fetch modules (no global `window.KSCW`)
- Admin page stays (rewritten for Directus REST) — needed for collaborator access
- Mix of Directus REST (simple reads) and custom `/kscw/*` endpoints (contact form, complex logic)
- Runtime hostname detection for prod/dev URL switching (CF Pages doesn't differentiate env vars)
- Migrate file assets from PocketBase to Directus asset storage

## Architecture

### Directus URL Detection

```typescript
function getDirectusUrl(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    return (h === 'kscw.ch' || h === 'www.kscw.ch')
      ? 'https://directus.kscw.ch'
      : 'https://directus-dev.kscw.ch'
  }
  return import.meta.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch'
}
```

| Hostname | Directus URL |
|---|---|
| `kscw.ch`, `www.kscw.ch` | `https://directus.kscw.ch` |
| Everything else | `https://directus-dev.kscw.ch` |

### API Client (`src/lib/directus.ts`)

Thin typed fetch wrapper — no SDK dependency.

**Exports:**
- `getDirectusUrl()` — runtime URL detection
- `directusFetch<T>(path, options?)` — core fetch with error handling
- `fetchItems<T>(collection, { filter, sort, fields, limit, offset })` — collection query
- `fetchItem<T>(collection, id, fields?)` — single item
- `createItem<T>(collection, data)` — create record
- `updateItem<T>(collection, id, data)` — update record
- `deleteItem(collection, id)` — delete record
- `login(email, password)` — `POST /auth/login`
- `refreshToken(token)` — `POST /auth/refresh`
- `assetUrl(fileId, transforms?)` — `${URL}/assets/${fileId}?${transforms}`
- `kscwApi<T>(path, options?)` — `${URL}/kscw/${path}` for custom endpoints

### Per-Page Fetch Modules

Replace monolithic `data.js` (578 lines) with focused modules.

| Module | File | Collections | Consumers |
|---|---|---|---|
| Teams | `src/lib/fetch/teams.ts` | `teams` | Sport overview, contact form |
| Games | `src/lib/fetch/games.ts` | `games` (fields: `kscw_team.*`, `hall.*`) | Sport pages, homepage, team pages, scoreboard |
| Rankings | `src/lib/fetch/rankings.ts` | `rankings` | Sport pages, team pages |
| News | `src/lib/fetch/news.ts` | `news` | Homepage (build-time + client) |
| Events | `src/lib/fetch/events.ts` | `events` | Calendar, homepage (build-time) |
| Sponsors | `src/lib/fetch/sponsors.ts` | `sponsors` | Sponsor pages, team pages (build-time) |
| Team Detail | `src/lib/fetch/team-detail.ts` | via `/kscw/public/team/{id}` | Team detail pages |

**Build-time vs Client-side:**

| Data | Fetched At | Reason |
|---|---|---|
| News (homepage) | Build-time | SEO, initial render |
| Events (calendar) | Build-time + client hydration | SEO + interactive filtering |
| Sponsors | Build-time | Rarely changes, SEO for sponsors |
| Games, rankings | Client-side | Changes frequently, no SEO value |
| Team detail | Client-side | Dynamic per-team |

### Utility Helpers

`src/lib/utils.ts` — extracted from `data.js`:
- `formatDate(isoDate)`, `formatDateLong(isoDate)`
- `isWin(game)`, `getLeagueKey(sport, league)`

### Static Data (Unchanged)

`src/data/teams.ts` — TeamDef with colors, slugs, training info. Remove `pbId` field (Directus uses team IDs directly). Fetch modules merge Directus data with these static definitions.

## Write Paths

### Admin Page (`src/pages/admin.astro`)

Rewrite vanilla JS to use Directus REST instead of PocketBase SDK.

**Auth flow:**
1. `POST /auth/login` with email + password + Turnstile token
2. Store `access_token` + `refresh_token` + `expires_at` in sessionStorage
3. Auto-refresh before expiry (30s buffer)
4. Role check: `GET /users/me?fields=*,role.name` → resolve role UUID to name, verify `website_admin` / `admin` / `superuser`

**CRUD mapping:**

| Operation | PocketBase | Directus |
|---|---|---|
| List | `pb.collection('news').getList(1, 50, {sort})` | `GET /items/news?limit=50&sort={sort}` |
| Get one | `pb.collection('news').getOne(id)` | `GET /items/news/{id}` |
| Create | `pb.collection('news').create(formData)` | `POST /items/news` (multipart) |
| Update | `pb.collection('news').update(id, formData)` | `PATCH /items/news/{id}` |
| Delete | `pb.collection('news').delete(id)` | `DELETE /items/news/{id}` |
| Login | `pb.collection('members').authWithPassword(...)` | `POST /auth/login` |
| Password reset | `pb.collection('members').requestPasswordReset(...)` | `POST /kscw/password-request` (custom endpoint with Turnstile) |

**Unchanged:** Quill editor, DOMPurify, Turnstile, UI layout, team/member multi-select.

### Feedback Form (`public/js/feedback-form.js`)

- `POST /api/collections/feedback/records` → `POST /items/feedback`
- Same FormData multipart for screenshot upload
- Turnstile token in body (Directus hook validates)

### Contact Form (`public/js/contact-form.js`)

- Team dropdown: `GET /items/teams?filter[sport][_eq]={sport}&filter[active][_eq]=true&fields=id,name,league&sort=name`
- Submit: `POST /kscw/contact` (existing wiedisync custom endpoint with coach routing + email)

## File/Asset Migration

**One-time migration (not committed):**
1. Export all files from PocketBase (`/api/files/`) for teams, news, sponsors
2. Upload to Directus via `POST /files` (multipart/form-data)
3. Update records with new Directus asset IDs
4. All image URLs switch to `assetUrl(fileId, 'width=640&quality=80')` pattern

**Affected collections:**
- `teams.team_picture` — 40+ team photos
- `news.image` — news article images
- `sponsors.logo` — sponsor logos (if stored as files, not external URLs)

## Endpoint Strategy

| Endpoint | Type | Reason |
|---|---|---|
| `/items/teams`, `/items/games`, etc. | Directus REST | Simple reads with filters |
| `/items/news`, `/items/events` | Directus REST | CRUD for admin + reads |
| `/items/feedback` | Directus REST | Simple write (hook validates Turnstile) |
| `/kscw/contact` | Custom endpoint | Coach routing + email logic |
| `/kscw/password-request` | Custom endpoint | Password reset with Turnstile validation |
| `/kscw/public/team/{id}` | Custom endpoint | Complex join (roster + games + rankings) |

## Complete File Inventory

All files with PocketBase dependencies that must be migrated:

| File | PB Dependency | Migration Layer |
|---|---|---|
| `src/lib/pocketbase.ts` | Build-time fetch helpers | Layer 1 (replaced by `directus.ts`) |
| `public/js/data.js` | Global data layer, all collections | Layer 2 (replaced by per-page modules) |
| `public/js/team-page.js` | `window.KSCW` + `api.kscw.ch` direct fetch | Layer 2 |
| `public/js/scoreboard.js` | `window.KSCW` + `kscw-data-ready` event | Layer 2 |
| `public/js/game-modal.js` | `window.KSCW` for game data | Layer 2 |
| `public/js/news-modal.js` | Renders PB image URLs from `window.KSCW.news` | Layer 2 |
| `src/islands/calendar-grid.ts` | Direct PB API fetch for games + teams | Layer 2 |
| `src/pages/de/index.astro` + EN | Build-time news/events + client sponsor fetch | Layer 2 |
| `src/pages/de/weiteres/kalender.astro` + EN | Build-time event fetch | Layer 2 |
| `src/pages/de/sponsoren/index.astro` + EN | Direct `api.kscw.ch/api/public/sponsors` | Layer 2 |
| `src/pages/de/volleyball/index.astro` + EN | `window.KSCW` consumers | Layer 2 |
| `src/pages/de/basketball/index.astro` + EN | `window.KSCW` consumers | Layer 2 |
| `src/pages/admin.astro` | PB SDK CDN + full CRUD + auth | Layer 3 |
| `public/js/feedback-form.js` | POST to PB feedback collection | Layer 3 |
| `public/js/contact-form.js` | POST to PB contact + team dropdown | Layer 3 |
| `public/_headers` | CSP allows `api.kscw.ch` for img/connect-src | Layer 4 |
| `src/pages/de/club/feedback.astro` + EN | Text mentions "PocketBase" | Layer 4 |
| `src/data/teams.ts` | `pbId` field on TeamDef | Layer 4 |

**Note on Layer 2 coupling:** Since `data.js` populates `window.KSCW` which is consumed by `team-page.js`, `scoreboard.js`, `game-modal.js`, and `news-modal.js`, these files must all be migrated together — they cannot be deployed independently while `data.js` is being removed.

## CSP Headers Update

`public/_headers` must update `img-src` and `connect-src` from `api.kscw.ch` to both `directus.kscw.ch` and `directus-dev.kscw.ch` (since the static site connects to either at runtime).

## Build-Time Environment

Astro frontmatter runs at build time with no `window`. `getDirectusUrl()` falls back to `import.meta.env.DIRECTUS_URL`. This must be set:
- **Local dev:** `.env` file with `DIRECTUS_URL=https://directus-dev.kscw.ch`
- **CF Pages build:** Environment variable `DIRECTUS_URL=https://directus.kscw.ch`

## `pbId` → Directus ID Mapping

PocketBase used random string IDs (e.g., `qz7y8l4tz48f65j`). Directus uses integer IDs (stringified on frontend via `stringifyIds()` in wiedisync). The `pbId` field in `src/data/teams.ts` will be replaced with `directusId` containing the Directus integer ID (as string) for each team. Fetch modules use this to merge static TeamDef config with Directus API data.

## Games Fetch — No Custom Endpoint

The old PB had a `/api/public/games` convenience endpoint. Directus does not have this — the games fetch module will use `GET /items/games` with appropriate filters, sort, and `fields=*,kscw_team.*,hall.*` to replicate the same data. This is slightly more complex but avoids needing a new custom endpoint.

## Migration Layers

| Layer | Scope | Files | Deployable Alone |
|---|---|---|---|
| **1. Foundation** | `directus.ts` wrapper + `utils.ts` + asset migration | 2 new files + migration script | Yes |
| **2. Read paths** | 7 fetch modules + ~18 page/script rewrites | ~25 files modified/created | Yes (but `data.js` consumers must migrate together) |
| **3. Write paths** | Admin + feedback + contact forms | 3 files rewritten | Yes (independent from reads) |
| **4. Cleanup** | Delete PB code, update CSP, verify zero references | ~6 files deleted/updated | Yes |

## Cleanup Verification

After migration, all must return 0 hits:
```bash
grep -r "api\.kscw\.ch" src/ public/           # Old PB API URL
grep -r "pocketbase\|PocketBase" src/ public/   # SDK references (excluding docs/changelog)
grep -r "window\.KSCW" src/ public/             # Global data object
grep -r "kscw-data-ready" src/ public/          # Global data event
grep -r "pb\.\|pb_\|pbId" src/ public/          # PB variable references
grep -r "api\.kscw\.ch" public/_headers          # CSP headers
grep -r "/api/files/" src/ public/              # PB file URL pattern
grep -r "/api/collections/" src/ public/        # PB collection URL pattern
```

## Parallel Execution Plan

Layers 2 and 3 are independent — read path modules and write path rewrites can be developed in parallel via subagents.

Within Layer 2, each fetch module + its page consumer(s) is independent and can be parallelized:
- Teams fetch + sport overview pages
- Games fetch + game display pages
- Rankings fetch + rankings display
- News fetch + homepage news section
- Events fetch + calendar pages
- Sponsors fetch + sponsor pages
- Team detail fetch + team pages

## Out of Scope

- Directus schema changes (collections already exist from wiedisync migration)
- Postgres triggers (already deployed)
- Custom endpoints (already deployed in wiedisync)
- Wiedisync frontend (already migrated)
- Email templates (already in Directus)
