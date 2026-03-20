# UI Test Suite Design — kscw-website

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Comprehensive UI testing for kscw-website (42 pages, 8 islands, 2 locales, admin panel)

## Problem

No automated tests exist. UI issues (overflow, dead links, broken interactivity, missing translations) are caught manually, repeatedly.

## Solution

Two test frameworks running in GitHub Actions CI on push to `dev` and `prod`:

1. **Vitest** — fast unit/integration tests for data and i18n (~2s)
2. **Playwright** — browser-based E2E tests for UI, layout, navigation, interactivity

## Viewports

Two breakpoints tested throughout:
- **Mobile:** 375px width
- **Desktop:** 1280px width

## CI Pipeline

**GitHub Actions workflow** triggered on push to `dev` and `prod`:

1. Checkout code
2. Install dependencies (`npm ci`)
3. Build site (`npx astro build`) — requires network access to `api.kscw.ch` for build-time data fetches. If API is unreachable, the build fails and tests are skipped (acceptable — no point testing a broken build).
4. Run Vitest
5. Run Playwright (uses `webServer` config to auto-start `astro preview` on port 4321)
6. Fail pipeline if any test fails

**Admin auth:** PocketBase test credentials stored as GitHub Actions secrets:
- `PB_TEST_EMAIL`
- `PB_TEST_PASSWORD`

## Test Structure

```
tests/
├── unit/
│   ├── i18n-completeness.test.ts
│   ├── i18n-helpers.test.ts
│   └── data-integrity.test.ts
└── e2e/
    ├── navigation.spec.ts
    ├── layout.spec.ts
    ├── i18n.spec.ts
    ├── islands.spec.ts
    ├── admin.spec.ts
    └── accessibility.spec.ts
```

## Configuration Files

### `vitest.config.ts`

- Environment: `node`
- Resolve aliases: match Astro's `tsconfig.json` paths (e.g., `src/` → `./src/`)
- Include: `tests/unit/**/*.test.ts`
- JSON import support (for `.json` data files)

### `playwright.config.ts`

- Base URL: `http://localhost:4321`
- `webServer` block: starts `npx astro preview` and waits for port 4321
- Projects: Chromium only (sufficient for UI regression — add Firefox/WebKit later if needed)
- Two viewport configs per test: 375px and 1280px
- `use.reducedMotion: 'no-preference'` — ensures animations run for testability
- Environment variables: `PB_TEST_EMAIL`, `PB_TEST_PASSWORD` read from `process.env`

---

## Vitest Tests

### `tests/unit/i18n-completeness.test.ts`

Translation parity between DE and EN:
- Every key in `de.json` exists in `en.json` and vice versa
- No empty string values
- Flag when DE value === EN value (possible untranslated string)

### `tests/unit/i18n-helpers.test.ts`

Test `src/lib/i18n.ts` helper functions. Note: `getLocaleFromUrl` and `getAlternateUrl` accept a `URL` object, not a string.

- `t('de', key)` returns German string
- `t('en', key)` returns English string
- `t('en', missingKey)` falls back to German
- `getLocaleFromUrl(new URL('http://localhost/de/club/kontakt'))` → `'de'`
- `getLocaleFromUrl(new URL('http://localhost/en/club/kontakt'))` → `'en'`
- `getAlternateUrl(new URL('http://localhost/de/club/kontakt'))` → `'/en/club/kontakt'`
- `getAlternateUrl(new URL('http://localhost/en/club/kontakt'))` → `'/de/club/kontakt'`

### `tests/unit/data-integrity.test.ts`

Static data validation based on actual schemas:

- `board-members.json`: every entry has `name`, `initials`, `role_de`, `role_en`, `order` (non-empty values)
- `contact-persons.json`: every entry has `name`, `email` (non-empty string containing `@`), `sport`, `order`
- `teams.ts`: all teams have required fields (`pbId`, `slug`, `sport`, `displayName`, `category`), no duplicate slugs

---

## Playwright E2E Tests

### `tests/e2e/navigation.spec.ts`

Links and routing (both viewports):

- Collect all internal links from key pages (home, volleyball index, basketball index, club pages, footer) — verify no 404s. Not a full recursive crawl — test a representative sample (~20 pages) to stay fast.
- Language switcher navigates to correct alternate locale page
- Desktop nav links all work
- Footer links all work
- Browser back/forward navigation works

Mobile-specific:
- Hamburger menu opens, links are clickable, menu closes after navigation

### `tests/e2e/layout.spec.ts`

Visual/overflow checks (both viewports):
- No horizontal scrollbar on any page (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`)
- No elements visibly overflowing the viewport
- Header and footer visible on every page
- All `<img>` elements have `alt` attributes and load successfully (no broken images)
- No zero-height content elements (text containers have `offsetHeight > 0`)

### `tests/e2e/i18n.spec.ts`

Locale correctness:
- `/de/` pages: `<html lang="de">`, spot-check known German strings appear
- `/en/` pages: `<html lang="en">`, spot-check known English strings appear
- No page has mixed-locale content (e.g., German nav on English page)

### `tests/e2e/islands.spec.ts`

Interactive component testing. Each test targets the specific page where the island appears.

- **Theme toggle** (any page): click toggles dark/light class, persists after reload
- **Mobile nav** (any page, mobile viewport only): hamburger opens menu, links clickable, closes on navigation
- **Scroll animations** (home page): `.fade-in` elements receive `.visible` class when scrolled into view
- **Accordion** (page with accordion, e.g., FAQ or regulations): click expands section, click again collapses
- **Event cards** (calendar page): click expands description, click again collapses
- **Stat counters** (home page): scroll into view, verify final numbers are non-zero after a short wait. Note: `prefers-reduced-motion` is disabled in Playwright config to allow animation testing.
- **Sponsor carousel** (home page): verify cloned children exist in DOM (animation is CSS-driven, not JS-observable)
- **Calendar grid** (calendar page): renders month view, day headers visible, prev/next month buttons navigate, "Today" button returns to current month

### `tests/e2e/admin.spec.ts`

Admin panel flows (authenticated with test credentials via env vars).

**Cleanup strategy:** All test-created records use a `[TEST]` title prefix. An `afterAll` hook deletes all `[TEST]`-prefixed events/news via PocketBase SDK. If cleanup fails (e.g., CI crash), stale `[TEST]` records are harmless and identifiable.

- Login: enter credentials, verify dashboard loads
- Tab switching: click News tab, click Events tab — correct content shown
- Create event: fill title (`[TEST] CI Event`), select type, set date, save → event appears in list
- Edit event: modify test event title, save → title updated
- Delete event: click delete, confirm → event removed from list
- Participation toggle: check `participation_required` → fields appear; uncheck → fields hide
- Quill editor: type content, save, reload — content persists

### `tests/e2e/accessibility.spec.ts`

Basic accessibility checks:
- All interactive elements (buttons, links, inputs) are keyboard-focusable
- All `<img>` elements have `alt` text
- Heading hierarchy: no skipped levels (e.g., h1 → h3 without h2)
- Focus indicators visible on interactive elements

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "@playwright/test": "^1.x"
  },
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "vitest run && playwright test"
  }
}
```

## GitHub Actions Workflow

File: `.github/workflows/test.yml`

- Trigger: push to `dev`, `prod`
- Node 22
- Steps: install → build → vitest → playwright (auto-starts preview via `webServer` config)
- Secrets: `PB_TEST_EMAIL`, `PB_TEST_PASSWORD`
- Playwright browsers cached for speed
- Timeout: 10 minutes (generous for full suite)

## Notes

- Admin tests create/edit/delete test events — all prefixed `[TEST]`, cleaned up in `afterAll`
- Playwright tests run against the built static site served by `astro preview`
- The site fetches data from PocketBase at build time — CI requires network access to `api.kscw.ch`
- Wiedisync (kscw platform) will get its own separate test suite in a future session
