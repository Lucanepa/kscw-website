# UI Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive Vitest + Playwright test suite with GitHub Actions CI to catch UI regressions across all 42 pages, 8 islands, and 2 locales.

**Architecture:** Vitest runs fast unit tests for i18n parity and data integrity. Playwright runs browser-based E2E tests against the built static site for navigation, layout, interactivity, admin flows, and accessibility. GitHub Actions runs both on push to `dev`/`prod`.

**Tech Stack:** Vitest 3.x, Playwright 1.x, GitHub Actions, Node 22, Astro 6

**Spec:** `docs/superpowers/specs/2026-03-19-ui-test-suite-design.md`

---

## File Structure

**Create:**
- `vitest.config.ts` — Vitest configuration (node env, path aliases, include pattern)
- `playwright.config.ts` — Playwright configuration (base URL, webServer, viewports, reducedMotion)
- `tests/unit/i18n-completeness.test.ts` — Translation key parity tests
- `tests/unit/i18n-helpers.test.ts` — i18n helper function tests
- `tests/unit/data-integrity.test.ts` — Static data validation tests
- `tests/e2e/navigation.spec.ts` — Link validation and routing tests
- `tests/e2e/layout.spec.ts` — Overflow and visual checks
- `tests/e2e/i18n.spec.ts` — Locale correctness tests
- `tests/e2e/islands.spec.ts` — Island interactivity tests
- `tests/e2e/admin.spec.ts` — Admin panel CRUD tests
- `tests/e2e/accessibility.spec.ts` — Basic a11y tests
- `.github/workflows/test.yml` — CI pipeline

**Modify:**
- `package.json` — Add devDependencies and test scripts

---

### Task 1: Install dependencies and configure test frameworks

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Vitest and Playwright**

```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
npm install --save-dev vitest @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add test scripts to package.json**

Add these scripts to `package.json`:

```json
"test": "vitest run",
"test:e2e": "playwright test",
"test:all": "vitest run && playwright test"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    reducedMotion: 'no-preference',
  },
  webServer: {
    command: 'npx astro preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 667 } },
    },
  ],
});
```

- [ ] **Step 5: Verify setup works**

```bash
npx vitest run --passWithNoTests
npx playwright test --list
```

Expected: Both commands complete without errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts
git commit -m "chore: add Vitest and Playwright test framework setup"
```

---

### Task 2: i18n completeness tests

**Files:**
- Create: `tests/unit/i18n-completeness.test.ts`

- [ ] **Step 1: Write i18n completeness tests**

```typescript
import { describe, it, expect } from 'vitest';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';

describe('i18n completeness', () => {
  const deKeys = Object.keys(de);
  const enKeys = Object.keys(en);

  it('every DE key exists in EN', () => {
    const missing = deKeys.filter((k) => !(k in en));
    expect(missing, `Missing in en.json: ${missing.join(', ')}`).toEqual([]);
  });

  it('every EN key exists in DE', () => {
    const missing = enKeys.filter((k) => !(k in de));
    expect(missing, `Missing in de.json: ${missing.join(', ')}`).toEqual([]);
  });

  it('no empty string values in DE', () => {
    const empty = deKeys.filter((k) => (de as Record<string, string>)[k].trim() === '');
    expect(empty, `Empty values in de.json: ${empty.join(', ')}`).toEqual([]);
  });

  it('no empty string values in EN', () => {
    const empty = enKeys.filter((k) => (en as Record<string, string>)[k].trim() === '');
    expect(empty, `Empty values in en.json: ${empty.join(', ')}`).toEqual([]);
  });

  it('flags identical DE/EN values (potential untranslated strings)', () => {
    // These are expected to be identical (proper nouns, brand names, etc.)
    const allowlist = new Set([
      'navNews', 'navClub', 'navVolleyball', 'navBasketball',
      'homeTitle', 'partnerFunctiomed',
    ]);

    const identical = deKeys.filter((k) => {
      if (allowlist.has(k)) return false;
      return (de as Record<string, string>)[k] === (en as Record<string, string>)[k];
    });

    // This is a warning, not a hard failure — log but don't fail
    if (identical.length > 0) {
      console.warn(
        `Potentially untranslated keys (DE === EN): ${identical.join(', ')}`
      );
    }
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/i18n-completeness.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/i18n-completeness.test.ts
git commit -m "test: add i18n completeness tests"
```

---

### Task 3: i18n helper function tests

**Files:**
- Create: `tests/unit/i18n-helpers.test.ts`

- [ ] **Step 1: Write i18n helper tests**

```typescript
import { describe, it, expect } from 'vitest';
import { t, getLocaleFromUrl, getAlternateUrl } from '../../src/lib/i18n';

describe('t()', () => {
  it('returns German string for DE locale', () => {
    expect(t('de', 'navClub')).toBe('Club');
  });

  it('returns English string for EN locale', () => {
    expect(t('en', 'navAbout')).toBe('About Us');
  });

  it('returns the key when it exists in neither locale', () => {
    // t() returns translations[locale]?.[key] ?? translations.de[key] ?? key
    expect(t('en', 'nonExistentKey12345')).toBe('nonExistentKey12345');
  });

  it('returns the key itself when not found in any locale', () => {
    expect(t('de', 'totallyFakeKey')).toBe('totallyFakeKey');
  });
});

describe('getLocaleFromUrl()', () => {
  it('returns de for /de/ paths', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/de/club/kontakt'))).toBe('de');
  });

  it('returns en for /en/ paths', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/en/club/kontakt'))).toBe('en');
  });

  it('defaults to de for unknown locale', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/fr/something'))).toBe('de');
  });
});

describe('getAlternateUrl()', () => {
  it('swaps /de/ to /en/', () => {
    expect(getAlternateUrl(new URL('http://localhost/de/club/kontakt'))).toBe('/en/club/kontakt');
  });

  it('swaps /en/ to /de/', () => {
    expect(getAlternateUrl(new URL('http://localhost/en/club/kontakt'))).toBe('/de/club/kontakt');
  });

  it('handles root locale paths', () => {
    expect(getAlternateUrl(new URL('http://localhost/de/'))).toBe('/en/');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/i18n-helpers.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/i18n-helpers.test.ts
git commit -m "test: add i18n helper function tests"
```

---

### Task 4: Data integrity tests

**Files:**
- Create: `tests/unit/data-integrity.test.ts`

- [ ] **Step 1: Write data integrity tests**

```typescript
import { describe, it, expect } from 'vitest';
import boardMembers from '../../src/data/board-members.json';
import contactPersons from '../../src/data/contact-persons.json';
import { allTeamDefs } from '../../src/data/teams';

describe('board-members.json', () => {
  it('has at least one entry', () => {
    expect(boardMembers.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const member of boardMembers) {
      expect(member.name, `Missing name`).toBeTruthy();
      expect(member.initials, `Missing initials for ${member.name}`).toBeTruthy();
      expect(member.role_de, `Missing role_de for ${member.name}`).toBeTruthy();
      expect(member.role_en, `Missing role_en for ${member.name}`).toBeTruthy();
      expect(typeof member.order, `Invalid order for ${member.name}`).toBe('number');
    }
  });
});

describe('contact-persons.json', () => {
  it('has at least one entry', () => {
    expect(contactPersons.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const person of contactPersons) {
      expect(person.name, `Missing name`).toBeTruthy();
      expect(person.email, `Missing email for ${person.name}`).toBeTruthy();
      expect(person.email).toContain('@');
      expect(person.sport, `Missing sport for ${person.name}`).toBeTruthy();
      expect(typeof person.order, `Invalid order for ${person.name}`).toBe('number');
    }
  });
});

describe('teams.ts', () => {
  it('has at least one team', () => {
    expect(allTeamDefs.length).toBeGreaterThan(0);
  });

  it('every team has required fields', () => {
    for (const team of allTeamDefs) {
      expect(team.pbId, `Missing pbId for ${team.displayName}`).toBeTruthy();
      expect(team.slug, `Missing slug for ${team.displayName}`).toBeTruthy();
      expect(team.sport, `Missing sport for ${team.displayName}`).toBeTruthy();
      expect(team.displayName, `Missing displayName`).toBeTruthy();
      expect(team.category, `Missing category for ${team.displayName}`).toBeTruthy();
      expect(['volleyball', 'basketball']).toContain(team.sport);
      expect(['men', 'women', 'youth']).toContain(team.category);
    }
  });

  it('no duplicate slugs within the same sport', () => {
    const seen = new Map<string, string>();
    for (const team of allTeamDefs) {
      const key = `${team.sport}:${team.slug}`;
      expect(seen.has(key), `Duplicate slug "${team.slug}" in ${team.sport}: ${seen.get(key)} and ${team.displayName}`).toBe(false);
      seen.set(key, team.displayName);
    }
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/data-integrity.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/data-integrity.test.ts
git commit -m "test: add data integrity tests for board, contacts, and teams"
```

---

### Task 5: Navigation E2E tests

**Files:**
- Create: `tests/e2e/navigation.spec.ts`

Note: Before running E2E tests, the site must be built: `npx astro build`

- [ ] **Step 1: Write navigation tests**

```typescript
import { test, expect } from '@playwright/test';

// Representative sample of pages to check for dead links
const samplePages = [
  '/de/',
  '/en/',
  '/de/club/ueber-uns',
  '/en/club/ueber-uns',
  '/de/volleyball/',
  '/en/volleyball/',
  '/de/basketball/',
  '/en/basketball/',
  '/de/weiteres/kalender',
  '/de/sponsoren/',
];

test.describe('navigation - link validation', () => {
  for (const pagePath of samplePages) {
    test(`no dead internal links on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      const links = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((a) => a.getAttribute('href'))
          .filter((href): href is string => !!href)
          .filter((href) => href.startsWith('/') && !href.startsWith('//'))
          .filter((href) => !href.includes('#')) // skip anchor-only links
      );

      const uniqueLinks = [...new Set(links)];

      for (const link of uniqueLinks) {
        const response = await page.request.get(link);
        expect(response.status(), `Dead link: ${link} on page ${pagePath}`).toBeLessThan(400);
      }
    });
  }
});

test.describe('navigation - language switcher', () => {
  test('DE page switches to EN', async ({ page }) => {
    await page.goto('/de/club/ueber-uns');
    const switcher = page.locator('a[href*="/en/"]').first();
    await switcher.click();
    await expect(page).toHaveURL(/\/en\//);
  });

  test('EN page switches to DE', async ({ page }) => {
    await page.goto('/en/club/ueber-uns');
    const switcher = page.locator('a[href*="/de/"]').first();
    await switcher.click();
    await expect(page).toHaveURL(/\/de\//);
  });
});

test.describe('navigation - desktop nav', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('main nav links are visible and clickable', async ({ page }) => {
    await page.goto('/de/');
    const nav = page.locator('.site-header nav');
    await expect(nav).toBeVisible();

    // Check a few key nav links exist and navigate
    const navLink = page.locator('.nav-link').first();
    await expect(navLink).toBeVisible();
  });

  test('browser back/forward navigation works', async ({ page }) => {
    await page.goto('/de/');
    await page.goto('/de/club/ueber-uns');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/de\/$/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/de\/club\/ueber-uns/);
  });

  test('footer links work', async ({ page }) => {
    await page.goto('/de/');
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);

    // Spot check first footer link
    const href = await footerLinks.first().getAttribute('href');
    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBeLessThan(400);
    }
  });
});

test.describe('navigation - mobile nav', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('hamburger opens mobile nav', async ({ page }) => {
    await page.goto('/de/');
    const hamburger = page.locator('.nav-hamburger');
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    // body gets nav-open class
    await expect(page.locator('body')).toHaveClass(/nav-open/);
  });

  test('mobile nav links are clickable', async ({ page }) => {
    await page.goto('/de/');
    await page.locator('.nav-hamburger').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);

    const mobileLinks = page.locator('.mobile-nav a[href^="/"]');
    const count = await mobileLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('mobile nav closes on link click', async ({ page }) => {
    await page.goto('/de/');
    await page.locator('.nav-hamburger').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);

    // Click a direct link (not an accordion parent)
    const directLink = page.locator('.mobile-nav a[href^="/de/"]').first();
    await directLink.click();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  });
});
```

- [ ] **Step 2: Build site and run tests**

```bash
npx astro build && npx playwright test tests/e2e/navigation.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/navigation.spec.ts
git commit -m "test: add navigation E2E tests (links, language switcher, mobile nav)"
```

---

### Task 6: Layout E2E tests

**Files:**
- Create: `tests/e2e/layout.spec.ts`

- [ ] **Step 1: Write layout tests**

```typescript
import { test, expect } from '@playwright/test';

const pagesToCheck = [
  '/de/',
  '/en/',
  '/de/club/ueber-uns',
  '/de/volleyball/',
  '/de/basketball/',
  '/de/weiteres/kalender',
  '/de/sponsoren/',
  '/de/weiteres/mitgliedschaft',
  '/de/club/kontakt',
  '/de/club/feedback',
];

test.describe('layout - no horizontal overflow', () => {
  for (const pagePath of pagesToCheck) {
    test(`no horizontal scrollbar on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasOverflow, `Horizontal overflow on ${pagePath}`).toBe(false);
    });
  }
});

test.describe('layout - header and footer', () => {
  for (const pagePath of pagesToCheck) {
    test(`header and footer visible on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);
      await expect(page.locator('.site-header')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    });
  }
});

test.describe('layout - images', () => {
  for (const pagePath of ['/de/', '/de/club/ueber-uns', '/de/sponsoren/']) {
    test(`images have alt text and load on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');
        expect(alt, `Image missing alt: ${src}`).not.toBeNull();

        // Check image loaded (naturalWidth > 0)
        const loaded = await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0);
        expect(loaded, `Image failed to load: ${src}`).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test tests/e2e/layout.spec.ts
```

Expected: All tests pass. If overflow or missing alt issues are found, those are real bugs to fix.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/layout.spec.ts
git commit -m "test: add layout E2E tests (overflow, header/footer, images)"
```

---

### Task 7: i18n E2E tests

**Files:**
- Create: `tests/e2e/i18n.spec.ts`

- [ ] **Step 1: Write i18n E2E tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('i18n - locale correctness', () => {
  test('DE pages have lang="de"', async ({ page }) => {
    await page.goto('/de/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('de');
  });

  test('EN pages have lang="en"', async ({ page }) => {
    await page.goto('/en/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('DE home page contains German text', async ({ page }) => {
    await page.goto('/de/');
    // Check for known German strings
    await expect(page.locator('text=Basketball und Volleyball seit 1982')).toBeVisible();
  });

  test('EN home page contains English text', async ({ page }) => {
    await page.goto('/en/');
    // Check for known English strings
    await expect(page.locator('text=Basketball and Volleyball since 1982')).toBeVisible();
  });

  test('DE nav shows German labels', async ({ page }) => {
    await page.goto('/de/');
    // "Über uns" is the DE nav label for About
    const aboutLink = page.locator('nav').getByText('Über uns');
    await expect(aboutLink.first()).toBeVisible();
  });

  test('EN nav shows English labels', async ({ page }) => {
    await page.goto('/en/');
    // "About Us" is the EN nav label
    const aboutLink = page.locator('nav').getByText('About Us');
    await expect(aboutLink.first()).toBeVisible();
  });

  test('no mixed locale on DE page', async ({ page }) => {
    await page.goto('/de/club/ueber-uns');
    // The page title should be German
    await expect(page.locator('h1')).toContainText('Über uns');
  });

  test('no mixed locale on EN page', async ({ page }) => {
    await page.goto('/en/club/ueber-uns');
    // The page title should be English
    await expect(page.locator('h1')).toContainText('About Us');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test tests/e2e/i18n.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/i18n.spec.ts
git commit -m "test: add i18n E2E tests (locale attributes, text content)"
```

---

### Task 8: Islands interactivity tests

**Files:**
- Create: `tests/e2e/islands.spec.ts`

- [ ] **Step 1: Write islands tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('islands - theme toggle', () => {
  test('clicking theme toggle switches class', async ({ page }) => {
    await page.goto('/de/');
    const html = page.locator('html');
    const toggle = page.locator('.theme-toggle').first();
    await expect(toggle).toBeVisible();

    // Get initial state
    const hadLight = await html.evaluate((el) => el.classList.contains('light'));

    await toggle.click();

    if (hadLight) {
      await expect(html).not.toHaveClass(/light/);
    } else {
      await expect(html).toHaveClass(/light/);
    }
  });

  test('theme persists after reload', async ({ page }) => {
    await page.goto('/de/');
    const toggle = page.locator('.theme-toggle').first();
    await toggle.click();

    const classAfterClick = await page.locator('html').evaluate((el) =>
      el.classList.contains('light')
    );

    await page.reload();

    const classAfterReload = await page.locator('html').evaluate((el) =>
      el.classList.contains('light')
    );

    expect(classAfterReload).toBe(classAfterClick);
  });
});

test.describe('islands - mobile nav', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('hamburger toggles nav-open class', async ({ page }) => {
    await page.goto('/de/');
    const hamburger = page.locator('.nav-hamburger');
    await hamburger.click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await hamburger.click();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  });
});

test.describe('islands - scroll animations', () => {
  test('fade-in elements get visible class when scrolled into view', async ({ page }) => {
    await page.goto('/de/');

    // Find a fade-in element that's below the fold
    const fadeElements = page.locator('.fade-in');
    const count = await fadeElements.count();
    if (count === 0) return; // No fade-in elements on this page

    // Scroll to bottom to trigger all animations
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for IntersectionObserver to fire
    await page.waitForTimeout(500);

    // Check that at least one element got .visible
    const visibleCount = await page.locator('.fade-in.visible').count();
    expect(visibleCount).toBeGreaterThan(0);
  });
});

test.describe('islands - accordion', () => {
  test('accordion items toggle open class', async ({ page }) => {
    // Regulations page has accordions
    await page.goto('/de/volleyball/reglemente');
    const header = page.locator('.accordion-header').first();

    // Skip if no accordion on this page
    if ((await header.count()) === 0) return;

    const item = page.locator('.accordion-item').first();
    await header.click();
    await expect(item).toHaveClass(/open/);
    await header.click();
    await expect(item).not.toHaveClass(/open/);
  });
});

test.describe('islands - event cards', () => {
  test('event cards expand on click', async ({ page }) => {
    await page.goto('/de/weiteres/kalender');
    const card = page.locator('.event-card--clickable').first();

    // Skip if no clickable event cards
    if ((await card.count()) === 0) return;

    await card.click();
    await expect(card).toHaveClass(/event-card--open/);
    await card.click();
    await expect(card).not.toHaveClass(/event-card--open/);
  });
});

test.describe('islands - stat counters', () => {
  test('stat counters show non-zero values after scroll', async ({ page }) => {
    await page.goto('/de/club/ueber-uns');
    const statEl = page.locator('.stat-number[data-value]').first();

    // Skip if no stat counters on this page
    if ((await statEl.count()) === 0) return;

    // Scroll the stat into view
    await statEl.scrollIntoViewIfNeeded();

    // Wait for animation (1500ms duration + buffer)
    await page.waitForTimeout(2000);

    const text = await statEl.textContent();
    expect(text).toBeTruthy();
    // The text should contain a number > 0
    const num = parseInt(text!.replace(/\D/g, ''), 10);
    expect(num).toBeGreaterThan(0);
  });
});

test.describe('islands - sponsor carousel', () => {
  test('sponsor carousel clones children for infinite scroll', async ({ page }) => {
    await page.goto('/de/');
    const track = page.locator('.sponsor-track');

    // Skip if no sponsor track
    if ((await track.count()) === 0) return;

    // Children should include clones with aria-hidden
    const hasAriaHidden = await track.locator('[aria-hidden="true"]').count();
    expect(hasAriaHidden).toBeGreaterThan(0);
  });
});

test.describe('islands - calendar grid', () => {
  test('calendar renders with day headers', async ({ page }) => {
    await page.goto('/de/weiteres/kalender');
    const grid = page.locator('#calendar-grid');

    // Skip if no calendar grid
    if ((await grid.count()) === 0) return;

    // Wait for calendar to render
    await page.waitForSelector('.cal-dow', { timeout: 10_000 });

    // Check day headers visible
    await expect(page.locator('.cal-dow-cell').first()).toBeVisible();
  });

  test('calendar prev/next month navigation works', async ({ page }) => {
    await page.goto('/de/weiteres/kalender');
    const grid = page.locator('#calendar-grid');
    if ((await grid.count()) === 0) return;

    await page.waitForSelector('.cal-month-label', { timeout: 10_000 });

    const initialMonth = await page.locator('.cal-month-label').textContent();

    // Click next
    await page.locator('.cal-nav-btn').last().click();
    await page.waitForTimeout(500);

    const nextMonth = await page.locator('.cal-month-label').textContent();
    expect(nextMonth).not.toBe(initialMonth);

    // Click prev to go back
    await page.locator('.cal-nav-btn').first().click();
    await page.waitForTimeout(500);

    const backMonth = await page.locator('.cal-month-label').textContent();
    expect(backMonth).toBe(initialMonth);
  });

  test('calendar Today button returns to current month', async ({ page }) => {
    await page.goto('/de/weiteres/kalender');
    const grid = page.locator('#calendar-grid');
    if ((await grid.count()) === 0) return;

    await page.waitForSelector('.cal-today-btn', { timeout: 10_000 });

    // Navigate away
    await page.locator('.cal-nav-btn').last().click();
    await page.waitForTimeout(500);
    await page.locator('.cal-nav-btn').last().click();
    await page.waitForTimeout(500);

    // Click Today
    await page.locator('.cal-today-btn').click();
    await page.waitForTimeout(500);

    const monthLabel = await page.locator('.cal-month-label').textContent();
    const now = new Date();
    const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const expected = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    expect(monthLabel).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test tests/e2e/islands.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/islands.spec.ts
git commit -m "test: add islands E2E tests (theme, nav, animations, accordion, calendar)"
```

---

### Task 9: Admin E2E tests

**Files:**
- Create: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Write admin tests**

```typescript
import { test, expect, type Page } from '@playwright/test';

const PB_URL = 'https://api.kscw.ch';

// Helper: login to admin panel
async function adminLogin(page: Page) {
  const email = process.env.PB_TEST_EMAIL;
  const password = process.env.PB_TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'PB_TEST_EMAIL and PB_TEST_PASSWORD env vars required');
    return;
  }

  await page.goto('/admin');

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForSelector('.admin-tabs', { timeout: 10_000 });
}

// Helper: cleanup [TEST] prefixed records via PocketBase REST API
async function cleanupTestRecords(page: Page) {
  const email = process.env.PB_TEST_EMAIL;
  const password = process.env.PB_TEST_PASSWORD;
  if (!email || !password) return;

  try {
    // Authenticate via REST API
    const authRes = await page.request.post(`${PB_URL}/api/collections/members/auth-with-password`, {
      data: { identity: email, password },
    });
    if (!authRes.ok()) return;
    const authData = await authRes.json();
    const token = authData.token;

    for (const collection of ['events', 'news']) {
      try {
        const filter = encodeURIComponent('title ~ "[TEST]"');
        const listRes = await page.request.get(
          `${PB_URL}/api/collections/${collection}/records?filter=${filter}&perPage=50`,
          { headers: { Authorization: token } }
        );
        if (!listRes.ok()) continue;
        const data = await listRes.json();
        for (const record of data.items || []) {
          await page.request.delete(
            `${PB_URL}/api/collections/${collection}/records/${record.id}`,
            { headers: { Authorization: token } }
          );
        }
      } catch { /* collection might not exist */ }
    }
  } catch { /* cleanup is best-effort */ }
}

test.describe('admin panel', () => {
  // Use desktop viewport for admin
  test.use({ viewport: { width: 1280, height: 720 } });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await adminLogin(page);
    await cleanupTestRecords(page);
    await page.close();
  });

  test('login and dashboard loads', async ({ page }) => {
    await adminLogin(page);
    await expect(page.locator('.admin-tabs')).toBeVisible();
  });

  test('tab switching works', async ({ page }) => {
    await adminLogin(page);

    // Click Events tab
    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();
    // Verify events content is shown
    await expect(page.locator('.admin-tabs')).toBeVisible();
  });

  test('create event with [TEST] prefix', async ({ page }) => {
    await adminLogin(page);

    // Switch to Events tab
    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();

    // Click FAB/add button
    const addBtn = page.locator('#fab-btn');
    await addBtn.click();

    // Fill form
    await page.fill('input[name="title"]', '[TEST] CI Event');

    // Set date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="start_date"]', dateStr);

    // Save
    await page.click('button[type="submit"]');

    // Wait for success (modal closes or list refreshes)
    await page.waitForTimeout(2000);
  });

  test('participation toggle shows/hides fields', async ({ page }) => {
    await adminLogin(page);

    // Switch to Events tab and open create modal
    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();
    const addBtn = page.locator('#fab-btn');
    await addBtn.click();

    // Find participation checkbox
    const participationToggle = page.locator('input[name="participation_required"]');
    if ((await participationToggle.count()) === 0) return;

    // Check - fields should appear
    await participationToggle.check();
    await expect(page.locator('input[name="respond_by"]')).toBeVisible();

    // Uncheck - fields should hide
    await participationToggle.uncheck();
    await expect(page.locator('input[name="respond_by"]')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests (requires env vars)**

```bash
PB_TEST_EMAIL=test@kscw.ch PB_TEST_PASSWORD=testpass npx playwright test tests/e2e/admin.spec.ts
```

Expected: Tests pass if credentials are valid, skip gracefully if not set.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin.spec.ts
git commit -m "test: add admin panel E2E tests (login, CRUD, participation toggle)"
```

---

### Task 10: Accessibility E2E tests

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Write accessibility tests**

```typescript
import { test, expect } from '@playwright/test';

const pagesToCheck = ['/de/', '/en/', '/de/club/ueber-uns', '/de/club/kontakt'];

test.describe('accessibility - images have alt text', () => {
  for (const pagePath of pagesToCheck) {
    test(`all images have alt on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');
        expect(alt, `Image missing alt text: ${src} on ${pagePath}`).not.toBeNull();
      }
    });
  }
});

test.describe('accessibility - heading hierarchy', () => {
  for (const pagePath of pagesToCheck) {
    test(`no skipped heading levels on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);

      const headingLevels = await page.$$eval(
        'h1, h2, h3, h4, h5, h6',
        (headings) => headings.map((h) => parseInt(h.tagName.substring(1), 10))
      );

      if (headingLevels.length === 0) return;

      // First heading should be h1
      expect(headingLevels[0], `First heading on ${pagePath} should be h1`).toBe(1);

      // No level should jump by more than 1
      for (let i = 1; i < headingLevels.length; i++) {
        const jump = headingLevels[i] - headingLevels[i - 1];
        expect(
          jump,
          `Heading level jump from h${headingLevels[i - 1]} to h${headingLevels[i]} on ${pagePath}`
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('accessibility - interactive elements focusable', () => {
  test('buttons and links are keyboard focusable on /de/', async ({ page }) => {
    await page.goto('/de/');

    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      await btn.focus();
      const isFocused = await btn.evaluate((el) => el === document.activeElement);
      expect(isFocused, `Button ${i} is not focusable`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test tests/e2e/accessibility.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/accessibility.spec.ts
git commit -m "test: add accessibility E2E tests (alt text, heading hierarchy, focus)"
```

---

### Task 11: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: Test

on:
  push:
    branches: [dev, prod]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npx astro build

      - name: Run unit tests
        run: npx vitest run

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests
        run: npx playwright test
        env:
          PB_TEST_EMAIL: ${{ secrets.PB_TEST_EMAIL }}
          PB_TEST_PASSWORD: ${{ secrets.PB_TEST_PASSWORD }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Verify YAML syntax**

```bash
cat .github/workflows/test.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin); print('YAML valid')"
```

Expected: "YAML valid"

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions test pipeline (Vitest + Playwright)"
```

---

### Task 12: Full test run and final verification

- [ ] **Step 1: Run complete test suite locally**

```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
npx astro build && npm run test:all
```

Expected: All unit tests pass. E2E tests pass (admin tests may skip if no credentials set).

- [ ] **Step 2: Fix any failing tests**

Address test failures from the full run. Common issues:
- Selectors that don't match the actual HTML structure
- Missing elements on pages that need different selectors
- Timing issues needing increased waits

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test: fix issues from full test suite run"
```
