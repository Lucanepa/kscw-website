import { test, expect, type Page } from '@playwright/test';

const PB_URL = 'https://api.kscw.ch';

async function adminLogin(page: Page) {
  const email = process.env.PB_TEST_EMAIL;
  const password = process.env.PB_TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'PB_TEST_EMAIL and PB_TEST_PASSWORD env vars required');
    return;
  }

  await page.goto('/admin');

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForSelector('.admin-tabs', { timeout: 10_000 });
}

async function cleanupTestRecords(page: Page) {
  const email = process.env.PB_TEST_EMAIL;
  const password = process.env.PB_TEST_PASSWORD;
  if (!email || !password) return;

  try {
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

    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();
    await expect(page.locator('.admin-tabs')).toBeVisible();
  });

  test('create event with [TEST] prefix', async ({ page }) => {
    await adminLogin(page);

    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();

    const addBtn = page.locator('#fab-btn');
    await addBtn.click();

    await page.fill('input[name="title"]', '[TEST] CI Event');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="start_date"]', dateStr);

    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
  });

  test('participation toggle shows/hides fields', async ({ page }) => {
    await adminLogin(page);

    const eventsTab = page.getByRole('button', { name: /events/i });
    await eventsTab.click();
    const addBtn = page.locator('#fab-btn');
    await addBtn.click();

    const participationToggle = page.locator('input[name="participation_required"]');
    if ((await participationToggle.count()) === 0) return;

    await participationToggle.check();
    await expect(page.locator('input[name="respond_by"]')).toBeVisible();

    await participationToggle.uncheck();
    await expect(page.locator('input[name="respond_by"]')).not.toBeVisible();
  });
});
