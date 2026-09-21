import { createHash } from 'node:crypto';
import type { ScanConsentState, ScanFindingType, ScanFindingInput } from '@cmp/database';
import { isTrackingPixelUrl, matchTracker } from './tracker-patterns';

function hostnameFromUrl(url: string | null | undefined) {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function hashValueSample(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.length > 200 ? `${value.slice(0, 200)}…` : value;
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 12);
  return `${trimmed} [sha256:${hash}]`;
}

interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

interface StorageEntry {
  key: string;
  value: string;
}

interface DomSnapshot {
  scripts: Array<{ src: string; inline: boolean }>;
  iframes: string[];
  pixels: string[];
  localStorage: StorageEntry[];
  sessionStorage: StorageEntry[];
  indexedDbNames: string[];
  serviceWorkerUrls: string[];
  networkUrls: string[];
}

export function cookiesToFindings(
  cookies: CookieRecord[],
  consentState: ScanConsentState,
  pageUrl: string,
  pageId: string | null,
  siteHostname: string,
): ScanFindingInput[] {
  return cookies.map((cookie) => {
    const cookieHost = cookie.domain.replace(/^\./, '').toLowerCase();
    const isThirdParty = !cookieHost.endsWith(siteHostname) && cookieHost !== siteHostname;
    return {
      findingType: 'COOKIE' as ScanFindingType,
      consentState,
      name: cookie.name,
      valueSample: hashValueSample(cookie.value),
      cookieDomain: cookie.domain,
      cookiePath: cookie.path,
      expiresAt: cookie.expires > 0 ? new Date(cookie.expires * 1000) : null,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      isThirdParty,
      pageUrl,
      pageId,
    };
  });
}

export function domSnapshotToFindings(
  snapshot: DomSnapshot,
  consentState: ScanConsentState,
  pageUrl: string,
  pageId: string | null,
  siteHostname: string,
): ScanFindingInput[] {
  const findings: ScanFindingInput[] = [];

  for (const script of snapshot.scripts) {
    const src = script.src;
    const tracker = src ? matchTracker(src) : null;
    findings.push({
      findingType: 'SCRIPT',
      consentState,
      name: tracker?.name ?? (script.inline ? 'inline-script' : src || 'script'),
      sourceUrl: src || null,
      technology: tracker?.name,
      pageUrl,
      pageId,
      isThirdParty: src ? !src.includes(siteHostname) : false,
      metadata: script.inline ? { inline: true } : undefined,
    });
  }

  for (const src of snapshot.iframes) {
    const tracker = matchTracker(src);
    findings.push({
      findingType: 'IFRAME',
      consentState,
      name: tracker?.name ?? src,
      sourceUrl: src,
      technology: tracker?.name,
      pageUrl,
      pageId,
      isThirdParty: !src.includes(siteHostname),
    });
  }

  for (const src of snapshot.pixels) {
    const tracker = matchTracker(src);
    findings.push({
      findingType: 'PIXEL',
      consentState,
      name: tracker?.name ?? src,
      sourceUrl: src,
      technology: tracker?.name,
      pageUrl,
      pageId,
      isThirdParty: !src.includes(siteHostname),
    });
  }

  for (const entry of snapshot.localStorage) {
    findings.push({
      findingType: 'LOCAL_STORAGE',
      consentState,
      name: entry.key,
      valueSample: hashValueSample(entry.value),
      pageUrl,
      pageId,
    });
  }

  for (const entry of snapshot.sessionStorage) {
    findings.push({
      findingType: 'SESSION_STORAGE',
      consentState,
      name: entry.key,
      valueSample: hashValueSample(entry.value),
      pageUrl,
      pageId,
    });
  }

  for (const dbName of snapshot.indexedDbNames) {
    findings.push({
      findingType: 'INDEXED_DB',
      consentState,
      name: dbName,
      pageUrl,
      pageId,
    });
  }

  for (const swUrl of snapshot.serviceWorkerUrls) {
    findings.push({
      findingType: 'SERVICE_WORKER',
      consentState,
      name: swUrl,
      sourceUrl: swUrl,
      pageUrl,
      pageId,
      isThirdParty: !swUrl.includes(siteHostname),
    });
  }

  for (const url of snapshot.networkUrls) {
    const tracker = matchTracker(url);
    if (!tracker) continue;
    findings.push({
      findingType: 'NETWORK_REQUEST',
      consentState,
      name: tracker.name,
      sourceUrl: url,
      technology: tracker.name,
      pageUrl,
      pageId,
      isThirdParty: !url.includes(siteHostname),
    });
  }

  return findings;
}

export interface FrameStorageSnapshot {
  frameUrl: string;
  localStorage: Array<{ key: string; value: string }>;
  sessionStorage: Array<{ key: string; value: string }>;
  indexedDbNames: string[];
}

export function frameStorageToFindings(
  frames: FrameStorageSnapshot[],
  consentState: ScanConsentState,
  pageId: string | null,
  siteHostname: string,
): ScanFindingInput[] {
  const findings: ScanFindingInput[] = [];
  const site = siteHostname.toLowerCase();

  for (const frame of frames) {
    const frameHost = hostnameFromUrl(frame.frameUrl);
    const isThirdParty =
      frameHost.length > 0 && frameHost !== site && !frameHost.endsWith(`.${site}`);

    for (const entry of frame.localStorage) {
      findings.push({
        findingType: 'LOCAL_STORAGE',
        consentState,
        name: entry.key,
        valueSample: hashValueSample(entry.value),
        pageUrl: frame.frameUrl,
        pageId,
        isThirdParty,
      });
    }

    for (const entry of frame.sessionStorage) {
      findings.push({
        findingType: 'SESSION_STORAGE',
        consentState,
        name: entry.key,
        valueSample: hashValueSample(entry.value),
        pageUrl: frame.frameUrl,
        pageId,
        isThirdParty,
      });
    }

    for (const dbName of frame.indexedDbNames) {
      findings.push({
        findingType: 'INDEXED_DB',
        consentState,
        name: dbName,
        pageUrl: frame.frameUrl,
        pageId,
        isThirdParty,
      });
    }
  }

  return findings;
}

export function collectPixelUrlsFromHtml(html: string): string[] {
  const pixels: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && isTrackingPixelUrl(src)) pixels.push(src);
  }
  return pixels;
}

export function countFindingStats(findings: ScanFindingInput[]) {
  const deduped = dedupeFindings(findings);
  const cookies = deduped.filter((f) =>
    ['COOKIE', 'LOCAL_STORAGE', 'SESSION_STORAGE', 'INDEXED_DB'].includes(f.findingType),
  ).length;
  const trackers = deduped.filter((f) =>
    ['SCRIPT', 'IFRAME', 'PIXEL', 'NETWORK_REQUEST', 'SERVICE_WORKER'].includes(f.findingType),
  ).length;
  return { cookies, trackers };
}

export function dedupeFindings(findings: ScanFindingInput[]): ScanFindingInput[] {
  const seen = new Set<string>();
  const result: ScanFindingInput[] = [];
  for (const finding of findings) {
    const key = [
      finding.findingType,
      finding.consentState,
      finding.name,
      finding.pageUrl ?? '',
      finding.sourceUrl ?? '',
      finding.cookieDomain ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }
  return result;
}
