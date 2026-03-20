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
    await expect(page.locator('text=Basketball und Volleyball seit 1982').first()).toBeVisible();
  });

  test('EN home page contains English text', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Basketball and Volleyball since 1982').first()).toBeVisible();
  });

  test('DE nav shows German labels', async ({ page }) => {
    await page.goto('/de/');
    const aboutLink = page.locator('nav').getByText('Über uns', { exact: true });
    await expect(aboutLink.first()).toBeAttached();
  });

  test('EN nav shows English labels', async ({ page }) => {
    await page.goto('/en/');
    const aboutLink = page.locator('nav').getByText('About Us', { exact: true });
    await expect(aboutLink.first()).toBeAttached();
  });

  test('no mixed locale on DE page', async ({ page }) => {
    await page.goto('/de/club/ueber-uns');
    await expect(page.locator('h1')).toContainText('Über uns');
  });

  test('no mixed locale on EN page', async ({ page }) => {
    await page.goto('/en/club/ueber-uns');
    await expect(page.locator('h1')).toContainText('About Us');
  });
});
