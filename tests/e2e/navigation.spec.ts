import { test, expect } from '@playwright/test';

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
          .filter((href) => !href.includes('#'))
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
    const href = await switcher.getAttribute('href');
    await page.goto(href!);
    await expect(page).toHaveURL(/\/en\//);
  });

  test('EN page switches to DE', async ({ page }) => {
    await page.goto('/en/club/ueber-uns');
    const switcher = page.locator('a[href*="/de/"]').first();
    const href = await switcher.getAttribute('href');
    await page.goto(href!);
    await expect(page).toHaveURL(/\/de\//);
  });
});

test.describe('navigation - desktop nav', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('main nav links are visible and clickable', async ({ page }) => {
    await page.goto('/de/');
    const nav = page.locator('.site-header nav');
    await expect(nav).toBeVisible();
    const navLink = page.locator('.nav-link').first();
    await expect(navLink).toBeVisible();
  });

  test('browser back/forward navigation works', async ({ page }) => {
    await page.goto('/de/');
    await page.goto('/de/club/ueber-uns');
    await page.goBack();
    await expect(page).toHaveURL(/\/de\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/de\/club\/ueber-uns/);
  });

  test('footer links work', async ({ page }) => {
    await page.goto('/de/');
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
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
    const directLink = page.locator('.mobile-nav a[href^="/de/"]').first();
    await directLink.click();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  });
});
