# Changelog

All notable changes to the KSC Wiedikon website are documented in this file.

## [3.2.3] — 2026-04-18

### Changed
- **News modal**: Removed all external links from the public news view — ticket and action links are now reserved for Wiedisync (members platform). When a news article contains external links, a Wiedisync CTA appears directing members to the login area for all links and tickets
- **News body typography**: Default text alignment is now justified with hyphenation and pretty wrapping, matching the Datenschutz/Impressum/Über uns style. Admin per-paragraph overrides from the Quill editor (`ql-align-center`, `ql-align-right`, `ql-align-justify`) are honored

## [3.2.2] — 2026-04-18

### Fixed
- **News page**: Removed redundant `is_published` filter from anonymous Directus queries. The Public role permission now enforces published-only at the item level and hides the `is_published` field, so the client filter caused 403 Forbidden and an empty news page. Affects homepage news widget, news list pages, and the RSS feed

## [3.2.1] — 2026-04-04

### Changed
- **Datenschutz & Impressum**: Added Hetzner hosting section (company: Gunzenhausen, datacenter: Nürnberg) to privacy policy and imprint — both DE and EN
- Updated deployment references from Cloudflare Pages to Hetzner
- **Auto-delete notifications**: Directus Flow deletes notifications older than 3 days (daily at 04:00 UTC)

## [3.2.0] — 2026-04-02

### New
- **Searchable nationality dropdown** with 5 favorites (CH, DE, FR, AT, IT) + all world countries with live search filter
- **Phone country code selector** with all countries (default +41 CH), favorites first
- **Basketball fee categories** populated: Aktiv Erwachsene (CHF 350), Junioren U18 (CHF 200), Passiv (CHF 50), Familie (CHF 600)
- **Basketball licence dropdown** (OTR 1, OTR 2, OTN) — replaces old Funktion checkboxes
- **Swiss Basketball PDF documents** section with download links: Lizenzantrag (mandatory), Player's Self Declaration + National Team Declaration (non-Swiss only, shown dynamically)
- **PDF pre-fill** via self-hosted pdf-lib — form data auto-fills downloaded PDFs

### Changed
- Anrede field auto-derived from Geschlecht (männlich→Herr, weiblich→Frau) — dropdown removed
- Funktion → Lizenz: Volleyball gets single "Schreiber" checkbox, Basketball gets OTR dropdown
- Gender options capitalised (Männlich/Weiblich, Male/Female)
- Privacy notice text justified
- ID upload: only front side required, back side optional

### Security
- Self-hosted pdf-lib (was unpkg CDN without SRI)
- Client-side file type + size validation before upload (JPG/PNG/WebP/PDF, max 10 MB)
- Turnstile CAPTCHA token reset on failed submission (previously stuck on retry)

## [3.1.0] — 2026-04-01

### New
- **Unified registration form** (`/de/weiteres/anmeldung`, `/en/weiteres/anmeldung`) for Volleyball, Basketball, and Passive memberships — replaces external ClubDesk form + Google Forms
- **Admin registrations tab** (`/admin` → Anmeldungen) with list view, status filters (pending/approved/rejected), detail/edit modal, approve/reject workflow
- **ClubDesk CSV export** from admin panel — semicolon-separated, UTF-8 with BOM, exact ClubDesk column headers for auto-mapping (no manual column assignment)
- **Basketball PDF pre-fill** — generates pre-filled Swiss Basketball Lizenzantrag + optional FIBA Player's Self Declaration and National Team Declaration using pdf-lib (client-side)
- **File uploads** for basketball ID copies (front/back) with download + auto-delete from admin
- **Confirmation emails** on registration: sport-specific content (VB: welcome + fees + volleymanager link, BB: next steps, Passive: invoice info)
- **Admin notification email** on each new registration
- **Privacy notice** inline on form with consent checkbox (90-day auto-deletion, right to early deletion)
- **Auto-deletion Flow** in Directus — daily cron deletes registrations + files older than 90 days
- **Expiring badge** in admin list for registrations approaching 90-day deletion

### Changed
- Mitgliedschaft page CTA buttons now link to internal registration form (previously: external kscw.ch + Google Forms)

## [3.0.0] — 2026-03-30

### Breaking Changes
- **PocketBase → Directus migration**: Entire API backend switched from PocketBase (`api.kscw.ch`) to Directus (`directus.kscw.ch` / `directus-dev.kscw.ch`), aligning with the wiedisync platform
- Removed monolithic `data.js` global data layer — each page now fetches only what it needs
- Removed `window.KSCW` global object and `kscw-data-ready` event

### New
- `src/lib/directus.ts` — thin typed Directus REST fetch wrapper (no SDK dependency)
- 7 per-page fetch modules in `src/lib/fetch/` (teams, games, rankings, news, events, sponsors, team-detail)
- `src/lib/utils.ts` — shared date/game helpers extracted from data.js
- Runtime hostname detection for prod/dev Directus URL switching
- `news` collection created in Directus (prod + dev) with public read access

### Changed
- Admin page rewritten: Directus REST auth + CRUD (replaces PocketBase SDK CDN)
- Calendar island fetches games/teams directly from Directus REST
- All team pages use `directusId` instead of `pbId`
- Feedback form submits to Directus `/items/feedback`
- Contact form uses Directus `/kscw/contact` custom endpoint
- Sponsor pages fetch at build-time from Directus
- CSP headers updated for `directus.kscw.ch` and `directus-dev.kscw.ch`

### Removed
- `public/js/data.js` (578 lines)
- `src/lib/pocketbase.ts`
- All `api.kscw.ch` references
- PocketBase SDK CDN script tag

### Data Migration
- 60 file assets migrated to Directus storage (team photos, news images, sponsor logos)
- 6 news records migrated from PocketBase to Directus `news` collection

## [1.2.1] — 2026-03-20

### Bug Fixes

- Fixed feedback form Turnstile validation failing with "Turnstile token required" despite successful CAPTCHA — PocketBase strips non-schema fields from multipart body, now sends token via `X-Turnstile-Token` header

## [1.2.0] — 2026-03-20

### Testing
- Added comprehensive test suite: Vitest (unit) + Playwright (E2E)
- 22 unit tests: i18n key parity, i18n helpers, data integrity (board, contacts, teams)
- 148 E2E tests across mobile (375px) and desktop (1280px): navigation, layout/overflow, i18n locale, islands interactivity, admin panel, accessibility
- GitHub Actions CI pipeline on push to `dev`/`prod`

### Bug Fixes
- Fixed 2 missing EN translation keys (`teamCaptainF`, `posSetterF`)
- Fixed calendar grid horizontal overflow on desktop
- Fixed Leaflet map causing horizontal overflow on mobile
- Fixed theme toggle not working (script not imported in BaseLayout)
- Fixed sponsor carousel not handling async-loaded content

## [1.1.0] — 2026-03-19

### Admin
- Redesigned admin login page with glassmorphism card, lock icon, and "Websiteverwaltung" subtitle
- Added password visibility toggle (eye icon)
- Proper dark mode and light mode support for login form
- Responsive design for mobile

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
- League name in contact form dropdown (not full team name)
- Accordion groups in sport dropdown navs (Women/Men/Youth)

### Games
- Homepage game rows with animations
- Game modal with sets, referees, venue, and officials
- Scoreboard with Absolute / Per Game toggle
- Aggregate metrics across all rows per team, unique team counting, tie ranking

### Calendar
- Live calendar grid with event tooltips and detail modals
- Events injected from PocketBase at build time
- Training filtering by valid_from/valid_until dates

### Content Pages
- Über uns with history section and Leaflet map (trio logo marker, Google Maps link)
- Scorer course video card on resources page
- Reglemente page with SVRZ embeds
- Sponsors page with PocketBase collection
- Impressum and Datenschutz pages with justified text

### Navigation
- Shared header loaded from partials
- Scrollable dropdowns when overflowing viewport
- Consistent nav order (Damen first in VB and BB)

### Feedback System
- Feedback form: bug / feature / feedback type pills
- Cloudflare Turnstile CAPTCHA (unauthenticated submissions)
- File upload with drag & drop (max 5 MB, PNG/JPG/WebP)
- PocketBase submission with hooks for email notification + GitHub issue creation

### Admin
- Hidden `/admin` page with PocketBase auth
- Quill rich-text editor + DOMPurify via CDN
- Roles: website_admin / admin / superuser

### Infrastructure
- Domain migration: lucanepa.com → kscw.ch
- CF Pages forced rewrites (200!) for clean team URLs
- Instagram embeds on homepage
