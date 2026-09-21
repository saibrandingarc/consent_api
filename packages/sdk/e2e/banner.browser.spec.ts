import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, '../dist/browser-test.js');

const categories = [
  { slug: 'strictly_necessary', name: 'Strictly Necessary', required: true, enabled: true, defaultState: 'ENABLED' },
  { slug: 'analytics', name: 'Analytics', required: false, enabled: true, defaultState: 'DISABLED' },
];

test.describe('banner browser rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent('<!doctype html><html><body><main>Page</main></body></html>');
    await page.addScriptTag({ path: bundlePath });
  });

  for (const layout of ['bottom_bar', 'center_modal', 'multi_step_modal']) {
    test(`renders ${layout} with core actions`, async ({ page }) => {
      await page.evaluate(
        ({ selectedLayout, cats }) => {
          const handle = window.cmpRenderBanner(
            {
              domainKey: 'dk_test',
              configVersion: 1,
              categories: cats,
              banner: {
                title: 'Privacy',
                description: 'We use cookies.',
                acceptButton: 'Accept all',
                rejectButton: 'Reject all',
                preferencesButton: 'Customize',
                layout: selectedLayout,
              },
            },
            () => undefined,
          );
          handle?.show();
        },
        { selectedLayout: layout, cats: categories },
      );

      await expect(page.locator('[data-cmp-action="accept-all"]')).toBeVisible();
      await expect(page.locator('[data-cmp-action="reject-all"]')).toBeVisible();
      await expect(page.locator('.cmp-banner')).toHaveCount(1);
    });
  }
});

declare global {
  interface Window {
    cmpRenderBanner: (
      config: unknown,
      onConsent: (categories: Record<string, boolean>) => void,
    ) => { show: () => void; destroy: () => void } | null;
  }
}
