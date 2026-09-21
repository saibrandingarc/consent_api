export function normalizeUrl(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url, base);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.hash = '';
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.pathname = pathname;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isSameSite(url: string, siteHostname: string) {
  const host = getHostname(url);
  if (!host) return false;
  const site = siteHostname.toLowerCase().replace(/^www\./, '');
  return host === site || host.endsWith(`.${site}`);
}

function isCrawlablePath(pathname: string) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path.startsWith('/_next/')) return false;
  if (/\.(css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(path)) {
    return false;
  }
  return true;
}

export function matchesPathRules(pathname: string, includePaths?: string[], excludePaths?: string[]) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (!isCrawlablePath(pathname)) return false;
  if (excludePaths?.length) {
    for (const pattern of excludePaths) {
      if (matchPathPattern(path, pattern)) return false;
    }
  }
  if (includePaths?.length) {
    return includePaths.some((pattern) => matchPathPattern(path, pattern));
  }
  return true;
}

function matchPathPattern(path: string, pattern: string) {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`;
  if (normalized.endsWith('*')) {
    return path.startsWith(normalized.slice(0, -1));
  }
  return path === normalized || path.startsWith(`${normalized}/`);
}

export function extractLinks(html: string, pageUrl: string, siteHostname: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }
    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized || !isSameSite(normalized, siteHostname)) continue;
    links.push(normalized);
  }
  return links;
}

/** Merge anchor hrefs from live DOM with regex extraction from HTML. */
export function mergeDiscoveredLinks(
  html: string,
  anchorHrefs: string[],
  pageUrl: string,
  siteHostname: string,
): string[] {
  const merged = new Set<string>();
  for (const link of extractLinks(html, pageUrl, siteHostname)) {
    merged.add(link);
  }
  for (const href of anchorHrefs) {
    if (
      !href ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue;
    }
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized && isSameSite(normalized, siteHostname)) {
      merged.add(normalized);
    }
  }
  return [...merged];
}

function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const locRegex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const loc = match[1]?.trim();
    if (loc) locs.push(loc);
  }
  return locs;
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': SCANNER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export const SCANNER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Chromium flags required for headless scans in Docker / Cloud Run. */
export const CHROMIUM_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--no-zygote',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI,BlinkGenPropertyTrees',
  '--mute-audio',
  '--renderer-process-limit=1',
];

function isLocalOrPrivateUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.')
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

async function collectSitemapUrls(
  sitemapUrl: string,
  siteHostname: string,
  collected: Set<string>,
  visitedSitemaps: Set<string>,
) {
  const normalizedSitemap = normalizeUrl(sitemapUrl);
  if (!normalizedSitemap || visitedSitemaps.has(normalizedSitemap)) return;
  visitedSitemaps.add(normalizedSitemap);

  const xml = await fetchText(normalizedSitemap);
  if (!xml) return;

  for (const loc of parseSitemapLocs(xml)) {
    if (/\.xml$/i.test(loc) && /sitemap/i.test(loc)) {
      await collectSitemapUrls(loc, siteHostname, collected, visitedSitemaps);
      continue;
    }
    const pageUrl = normalizeUrl(loc);
    if (pageUrl && isSameSite(pageUrl, siteHostname)) {
      collected.add(pageUrl);
    }
  }
}

/** Discover crawl targets from robots.txt and sitemap.xml (Cookiebot-style URL inventory). */
export async function discoverSitemapUrls(startUrl: string, siteHostname: string): Promise<string[]> {
  const origin = new URL(startUrl).origin;
  const collected = new Set<string>();
  const visitedSitemaps = new Set<string>();
  const sitemapCandidates = new Set<string>();

  const robots = await fetchText(`${origin}/robots.txt`, 10000);
  if (robots) {
    for (const line of robots.split('\n')) {
      const match = line.match(/^\s*sitemap:\s*(.+)\s*$/i);
      const candidate = match?.[1]?.trim();
      if (candidate && !isLocalOrPrivateUrl(candidate)) {
        sitemapCandidates.add(candidate);
      }
    }
  }

  sitemapCandidates.add(`${origin}/sitemap.xml`);
  sitemapCandidates.add(`${origin}/sitemap_index.xml`);

  for (const candidate of sitemapCandidates) {
    await collectSitemapUrls(candidate, siteHostname, collected, visitedSitemaps);
  }

  return [...collected];
}

export function enqueueDiscoveredLinks(
  links: string[],
  depth: number,
  seen: Set<string>,
  queue: Array<{ url: string; depth: number }>,
  includePaths?: string[],
  excludePaths?: string[],
) {
  for (const link of links) {
    const normalized = normalizeUrl(link);
    if (!normalized || seen.has(normalized)) continue;
    const pathName = new URL(normalized).pathname;
    if (!matchesPathRules(pathName, includePaths, excludePaths)) continue;
    queue.push({ url: normalized, depth });
  }
}

/** Fetch a single page and return same-site crawl targets from SSR HTML. */
export async function discoverLinksFromFetchPage(
  pageUrl: string,
  siteHostname: string,
): Promise<string[]> {
  const normalized = normalizeUrl(pageUrl);
  if (!normalized) return [];
  const html = await fetchText(normalized);
  if (!html) return [];
  return extractLinks(html, normalized, siteHostname);
}

/**
 * Discover same-site URLs via HTTP fetch (SSR HTML). Used for tests and optional deep discovery.
 */
export async function discoverLinksViaFetchBfs(
  startUrl: string,
  siteHostname: string,
  maxDepth: number,
  maxPages: number,
  includePaths?: string[],
  excludePaths?: string[],
): Promise<Array<{ url: string; depth: number }>> {
  const startNormalized = normalizeUrl(startUrl);
  if (!startNormalized) return [];

  const discovered: Array<{ url: string; depth: number }> = [];
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startNormalized, depth: 0 }];

  while (queue.length > 0 && discovered.length < maxPages) {
    const current = queue.shift()!;
    const normalized = normalizeUrl(current.url);
    if (!normalized || seen.has(normalized)) continue;

    const pathName = new URL(normalized).pathname;
    if (!matchesPathRules(pathName, includePaths, excludePaths)) continue;

    seen.add(normalized);
    discovered.push({ url: normalized, depth: current.depth });

    if (current.depth >= maxDepth) continue;

    const html = await fetchText(normalized, 12000);
    if (!html) continue;

    const links = extractLinks(html, normalized, siteHostname);
    for (const link of links) {
      const linkNormalized = normalizeUrl(link);
      if (!linkNormalized || seen.has(linkNormalized)) continue;
      const linkPath = new URL(linkNormalized).pathname;
      if (!matchesPathRules(linkPath, includePaths, excludePaths)) continue;
      queue.push({ url: linkNormalized, depth: current.depth + 1 });
    }
  }

  return discovered;
}

export function buildStartUrl(hostname: string, startUrl?: string) {
  if (startUrl) return startUrl;
  return `https://${hostname}/`;
}
