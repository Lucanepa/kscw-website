# Changelog

All notable changes to the KSC Wiedikon website are documented in this file.

## [3.2.3] — 2026-04-18

### Changed
- **News modal**: Removed all external links from the public news view — ticket and action links are now reserved for Wiedisync (members platform). When a news article contains external links, a Wiedisync CTA appears
- **News body typography**: Default text alignment is now justified with hyphenation and pretty wrapping, matching the Datenschutz/Impressum/Über uns style. Quill per-paragraph overrides (`ql-align-center`, `ql-align-right`, `ql-align-justify`) are honored

### Fixed
- **News page**: Removed redundant `is_published` filter from anonymous Directus queries — the Public role now enforces published-only at item level and hides the field, so the client filter caused 403 errors and an empty news page (homepage widget, news list, and RSS feed)

## [3.2.1] — 2026-04-04

### Changed
- **Datenschutz & Impressum**: Added Hetzner hosting section (Gunzenhausen, Nürnberg datacenter) — both DE and EN
- Updated deployment references from Cloudflare Pages to Hetzner
- **Auto-delete notifications**: Directus Flow deletes notifications older than 3 days (daily at 04:00 UTC)

## [3.2.0] — 2026-04-02

### New
- **Searchable nationality dropdown** with 5 favorites (CH, DE, FR, AT, IT) + all world countries
- **Phone country code selector** with all countries (default +41 CH), favorites first
- **Basketball fee categories**: Aktiv Erwachsene (CHF 350), Junioren U18 (CHF 200), Passiv (CHF 50), Familie (CHF 600)
- **Basketball licence dropdown** (OTR 1, OTR 2, OTN) — replaces old Funktion checkboxes
- **Swiss Basketball PDF documents** with download links: Lizenzantrag (mandatory), Self Declaration + National Team Declaration (non-Swiss only)
- **PDF pre-fill** via self-hosted pdf-lib — form data auto-fills downloaded PDFs

### Changed
- Anrede field auto-derived from Geschlecht (männlich→Herr, weiblich→Frau) — dropdown removed
- Funktion → Lizenz: Volleyball gets "Schreiber" checkbox, Basketball gets OTR dropdown
- Gender options capitalised (Männlich/Weiblich, Male/Female)
- ID upload: only front side required, back side optional

### Security
- Self-hosted pdf-lib (was unpkg CDN without SRI)
- Client-side file type + size validation before upload (JPG/PNG/WebP/PDF, max 10 MB)
- Turnstile CAPTCHA token reset on failed submission

## [3.1.0] — 2026-04-01

### New
- **Unified registration form** (`/de/weiteres/anmeldung`, `/en/weiteres/anmeldung`) for Volleyball, Basketball, and Passive memberships — replaces external ClubDesk form + Google Forms
- **Admin registrations tab** (`/admin` → Anmeldungen) with status filters, detail/edit modal, approve/reject workflow
- **ClubDesk CSV export** — semicolon-separated, UTF-8 BOM, exact ClubDesk column headers for auto-mapping
- **Basketball PDF pre-fill** — generates pre-filled Lizenzantrag + optional FIBA Self Declaration and National Team Declaration (client-side via pdf-lib)
- **File uploads** for ID copies (front/back) with download + auto-delete from admin
- **Confirmation emails** on registration: sport-specific content (VB: welcome + fees + volleymanager link, BB: next steps, Passive: invoice info)
- **Admin notification email** on each new registration
- **Privacy notice** inline with consent checkbox + auto-deletion Flow (90-day cron deletes registrations + files)
- **Expiring badge** in admin list for registrations approaching deletion

### Changed
- Mitgliedschaft page CTAs now link to internal registration form (was external kscw.ch + Google Forms)

## [3.0.0] — 2026-03-30

### Breaking
- **PocketBase → Directus migration**: API backend switched from `api.kscw.ch` to `directus.kscw.ch` / `directus-dev.kscw.ch`, aligning with the wiedisync platform
- Removed monolithic `data.js` global data layer, `window.KSCW` global, and `kscw-data-ready` event
- Removed `public/js/data.js`, `src/lib/pocketbase.ts`, all `api.kscw.ch` references, and PocketBase SDK CDN script

### New
- `src/lib/directus.ts` — thin typed Directus REST fetch wrapper (no SDK dependency)
- 7 per-page fetch modules in `src/lib/fetch/` (teams, games, rankings, news, events, sponsors, team-detail)
- Runtime hostname detection for prod/dev Directus URL switching
- `news` collection in Directus (prod + dev) with public read access

### Changed
- Admin page rewritten with Directus REST auth + CRUD
- Calendar, team pages, feedback, contact form, sponsors all migrated to Directus REST
- All team pages use `directusId` instead of `pbId`
- CSP headers updated for Directus domains

### Migration
- 60 file assets migrated to Directus storage (team photos, news, sponsor logos)
- 6 news records migrated from PocketBase

## [1.2.0] — 2026-03-20

### Testing
- Comprehensive test suite: Vitest (unit) + Playwright (E2E)
- 22 unit tests + 148 E2E tests across mobile (375px) and desktop (1280px)
- GitHub Actions CI pipeline on push to `dev`/`prod`

### Bug Fixes
- Feedback form Turnstile validation — token now sent via `X-Turnstile-Token` header (PocketBase was stripping non-schema fields from multipart body)
- Fixed 2 missing EN translation keys (`teamCaptainF`, `posSetterF`)
- Fixed calendar grid horizontal overflow on desktop
- Fixed Leaflet map causing horizontal overflow on mobile
- Fixed theme toggle not working (script not imported in BaseLayout)
- Fixed sponsor carousel not handling async-loaded content

## [1.0.0] — 2026-03-19

### Site Foundation
- Astro 6 static site with custom CSS design system
- PocketBase API backend (api.kscw.ch)
- Cloudflare Pages hosting with Worker-based URL routing
- Directory-based i18n: `/de/…` and `/en/…` with DE/EN toggle

### Teams
- Single dynamic team page replacing 16 static pages
- Live data from PocketBase: games, rankings, roster, training schedules, photos
- Promotion/relegation color bands on volleyball ranking rows
- Accordion groups in sport dropdown navs (Damen/Herren/Nachwuchs)

### Games & Calendar
- Homepage game rows with animations
- Game modal with sets, referees, venue, officials
- Scoreboard with Absolute / Per Game toggle, aggregate metrics, unique team counting, tie ranking
- Live calendar grid with event tooltips and detail modals (events injected at build time, training filtered by valid_from/until)

### Content & Navigation
- Über uns with history + Leaflet map (trio logo marker, Google Maps link)
- Reglemente page with SVRZ embeds, Sponsors page, Impressum & Datenschutz
- Shared header from partials, scrollable dropdowns, consistent nav order

### Feedback System
- Feedback form: bug / feature / feedback type pills
- Cloudflare Turnstile CAPTCHA + drag & drop file upload (max 5 MB, PNG/JPG/WebP)
- PocketBase submission with hooks for email + GitHub issue creation

### Admin
- Hidden `/admin` page with PocketBase auth, glassmorphism login card, password visibility toggle, dark/light mode
- Quill rich-text editor + DOMPurify via CDN
- Roles: website_admin / admin / superuser

### Infrastructure
- Domain migration: lucanepa.com → kscw.ch
- CF Pages forced rewrites (200!) for clean team URLs
- Instagram embeds on homepage
