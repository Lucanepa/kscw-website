# Changelog

All notable changes to the KSC Wiedikon website are documented in this file.

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
