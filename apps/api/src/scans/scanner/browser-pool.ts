import type { Browser } from 'playwright';
import { CHROMIUM_LAUNCH_ARGS } from './crawl.util';

const LAUNCH_TIMEOUT_MS = 60_000;

let browserPromise: Promise<Browser> | null = null;
let cachedBrowser: Browser | null = null;

async function loadPlaywright() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.NODE_ENV === 'production') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
  }
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'Playwright is not installed. Local dev: pnpm --filter @cmp/api playwright:install. Cloud Run: redeploy API image with Playwright browsers.',
    );
  }
}

/**
 * Shared Chromium process for Cloud Run scans.
 * Launching a new browser per scan often exceeds 30s on cold instances.
 */
export async function getSharedBrowser(): Promise<Browser> {
  if (cachedBrowser?.isConnected()) {
    return cachedBrowser;
  }

  if (!browserPromise) {
    browserPromise = (async () => {
      const playwright = await loadPlaywright();
      const browser = await playwright.chromium.launch({
        headless: true,
        timeout: LAUNCH_TIMEOUT_MS,
        args: CHROMIUM_LAUNCH_ARGS,
        chromiumSandbox: false,
      });
      browser.on('disconnected', () => {
        if (cachedBrowser === browser) {
          cachedBrowser = null;
        }
        browserPromise = null;
      });
      cachedBrowser = browser;
      return browser;
    })().catch((error) => {
      browserPromise = null;
      cachedBrowser = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Chromium launch failed (${message}). Check PLAYWRIGHT_BROWSERS_PATH=/ms-playwright and Cloud Run memory/CPU.`,
      );
    });
  }

  return browserPromise;
}

/** Warm Chromium during API boot so the first user scan is not paying cold-launch cost. */
export function warmSharedBrowser(): Promise<Browser> {
  return getSharedBrowser();
}

export async function closeSharedBrowser(): Promise<void> {
  const browser = cachedBrowser;
  cachedBrowser = null;
  browserPromise = null;
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    /* already closed */
  }
}

/** Force a fresh Chromium process (used after crash / target-closed errors). */
export async function relaunchSharedBrowser(): Promise<Browser> {
  await closeSharedBrowser();
  return getSharedBrowser();
}
