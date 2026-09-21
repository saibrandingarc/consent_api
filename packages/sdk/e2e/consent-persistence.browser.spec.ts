import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));

test.describe('consent persistence across navigation', () => {
  test('restores consent from localStorage after reload', async ({ page }) => {
    const pageA = path.join(root, 'fixtures/page-a.html');
    await page.goto(`file://${pageA}`);

    await page.evaluate(() => {
      localStorage.setItem(
        'cmp_consent_dk_nav',
        JSON.stringify({
          configVersion: 1,
          categories: { strictly_necessary: true, analytics: true },
          expiresAt: Date.now() + 86_400_000,
          savedAt: Date.now(),
        }),
      );
    });

    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem('cmp_consent_dk_nav'));
    expect(stored).toContain('analytics');
    expect(stored).toContain('strictly_necessary');
  });

  test('keeps visitor id in storage across reload', async ({ page }) => {
    const pageA = path.join(root, 'fixtures/page-a.html');
    await page.goto(`file://${pageA}`);

    await page.evaluate(() => {
      localStorage.setItem(
        'cmp_visitor_dk_reload',
        JSON.stringify({
          visitorId: 'v_reload_test',
          createdAt: Date.now(),
          expiresAt: Date.now() + 86_400_000,
        }),
      );
    });

    await page.reload();

    const reloaded = await page.evaluate(() => {
      const raw = localStorage.getItem('cmp_visitor_dk_reload');
      return raw ? JSON.parse(raw).visitorId : null;
    });

    expect(reloaded).toBe('v_reload_test');
  });

  test('navigates to a second page and keeps consent storage', async ({ page }) => {
    const pageA = path.join(root, 'fixtures/page-a.html');
    const pageB = path.join(root, 'fixtures/page-b.html');

    await page.goto(`file://${pageA}`);
    await page.evaluate(() => {
      localStorage.setItem(
        'cmp_consent_dk_pages',
        JSON.stringify({
          configVersion: 1,
          categories: { strictly_necessary: true, analytics: false },
          expiresAt: Date.now() + 86_400_000,
          savedAt: Date.now(),
        }),
      );
    });

    await page.goto(`file://${pageB}`);
    const stored = await page.evaluate(() => localStorage.getItem('cmp_consent_dk_pages'));
    expect(stored).toContain('"analytics":false');
  });
});
