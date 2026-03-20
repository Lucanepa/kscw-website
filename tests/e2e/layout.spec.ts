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

        const loaded = await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0);
        expect(loaded, `Image failed to load: ${src}`).toBe(true);
      }
    });
  }
});
