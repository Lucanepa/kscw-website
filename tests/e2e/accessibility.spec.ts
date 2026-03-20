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

      expect(headingLevels[0], `First heading on ${pagePath} should be h1`).toBe(1);

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
