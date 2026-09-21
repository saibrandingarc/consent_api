import { describe, expect, it } from 'vitest';
import {
  buildStartUrl,
  enqueueDiscoveredLinks,
  extractLinks,
  isSameSite,
  matchesPathRules,
  mergeDiscoveredLinks,
  normalizeUrl,
} from './crawl.util';

describe('crawl.util', () => {
  it('normalizes URLs and strips hash', () => {
    expect(normalizeUrl('https://example.com/path/#section')).toBe('https://example.com/path');
    expect(normalizeUrl('/about', 'https://example.com/blog/')).toBe('https://example.com/about');
  });

  it('matches include and exclude path rules', () => {
    expect(matchesPathRules('/blog/post', ['/blog'], ['/blog/private'])).toBe(true);
    expect(matchesPathRules('/blog/private/1', ['/blog'], ['/blog/private'])).toBe(false);
    expect(matchesPathRules('/docs', ['/blog'])).toBe(false);
  });

  it('merges DOM anchor hrefs with HTML extraction', () => {
    const links = mergeDiscoveredLinks(
      '<a href="/about">About</a>',
      ['/contact', 'https://other.com/page'],
      'https://example.com/',
      'example.com',
    );
    expect(links).toContain('https://example.com/about');
    expect(links).toContain('https://example.com/contact');
    expect(links.some((link) => link.includes('other.com'))).toBe(false);
  });

  it('skips static asset paths', () => {
    expect(matchesPathRules('/_next/static/chunk.js')).toBe(false);
    expect(matchesPathRules('/finance')).toBe(true);
  });

  it('enqueueDiscoveredLinks respects path rules and seen set', () => {
    const seen = new Set<string>(['https://example.com/about']);
    const queue: Array<{ url: string; depth: number }> = [];
    enqueueDiscoveredLinks(
      ['https://example.com/about', 'https://example.com/blog/post', 'https://example.com/private'],
      1,
      seen,
      queue,
      ['/blog'],
      ['/blog/private'],
    );
    expect(queue).toEqual([{ url: 'https://example.com/blog/post', depth: 1 }]);
  });

  it('detects same-site hostnames', () => {
    expect(isSameSite('https://www.example.com/page', 'example.com')).toBe(true);
    expect(isSameSite('https://cdn.example.com/page', 'example.com')).toBe(true);
    expect(isSameSite('https://evil.com', 'example.com')).toBe(false);
  });

  it('builds default start URL from hostname', () => {
    expect(buildStartUrl('example.com')).toBe('https://example.com/');
  });
});
