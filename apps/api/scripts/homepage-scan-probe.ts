/**
 * Local probe: same scanner path as production homepage scans.
 * Usage: pnpm --filter @cmp/api scan:homepage-probe -- https://varnarc.com/
 * (pnpm may pass a literal "--" argument; the script skips it.)
 *
 * First time: pnpm --filter @cmp/api playwright:install
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runWebsiteScan } from '../src/scans/scanner/scanner.engine';
import { dedupeFindings } from '../src/scans/scanner/capture.util';
import {
  groupScanFindingsForIngest,
  shouldIncludeInInventory,
} from '../src/cookies/scan-findings-ingest';
import { getHostname } from '../src/scans/scanner/crawl.util';

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.HOME) {
  const macCache = join(process.env.HOME, 'Library/Caches/ms-playwright');
  if (existsSync(macCache)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = macCache;
  }
}

function parseStartUrl(): string {
  const urlArg = process.argv
    .slice(2)
    .find((arg) => arg !== '--' && /^https?:\/\//i.test(arg));
  return urlArg ?? 'https://varnarc.com/';
}

const startUrl = parseStartUrl();

async function main() {
  const scan = {
    id: 'probe',
    domainId: 'probe',
    organizationId: 'probe',
    startUrl,
    maxPages: 1,
    maxDepth: 0,
    includePaths: null,
    excludePaths: null,
    timeoutMs: 45000,
    jsRendering: true,
    deviceType: 'desktop',
    status: 'RUNNING',
    pagesScanned: 0,
    cookiesFound: 0,
    trackersFound: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await runWebsiteScan(scan);
  const page = result.pageRecords[0];
  const unique = dedupeFindings(page?.findings ?? []);
  const siteHostname = getHostname(startUrl) ?? '';
  const inventoryFindings = unique.filter((f) => shouldIncludeInInventory(f, siteHostname));
  const grouped = groupScanFindingsForIngest(inventoryFindings);

  console.log(
    JSON.stringify(
      {
        startUrl,
        pagesScanned: result.pagesScanned,
        cookiesFound: result.cookiesFound,
        trackersFound: result.trackersFound,
        pageStatus: page?.status,
        pageError: page?.errorMessage,
        inventoryItems: grouped.length,
        inventory: grouped.map((g) => ({
          type: g.findingType,
          name: g.cookieName,
          sourceUrl: g.sourceUrl,
          beforeConsent: g.foundBeforeConsent,
        })),
      },
      null,
      2,
    ),
  );

  if (page?.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
