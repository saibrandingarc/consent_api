import { describe, expect, it } from 'vitest';
import { buildBlockingRules, matchPattern } from './rules';
import type { CategorySnapshot } from '../types';

describe('blocking rules', () => {
  it('matches substring and regex patterns', () => {
    expect(matchPattern('https://www.googletagmanager.com/gtag/js', 'googletagmanager.com')).toBe(true);
    expect(matchPattern('https://example.com/track/extra', '/track$/')).toBe(false);
    expect(matchPattern('https://example.com/track', '/track$/')).toBe(true);
    expect(matchPattern('https://example.com/track', '/track/')).toBe(true);
  });

  it('builds rules from category script mappings and known trackers', () => {
    const categories: CategorySnapshot[] = [
      {
        slug: 'analytics',
        name: 'Analytics',
        enabled: true,
        scriptMappings: { scripts: ['gtag/js'], pixels: ['analytics.example/pixel'] },
      },
      {
        slug: 'social_media',
        name: 'Social',
        enabled: true,
      },
    ];

    const rules = buildBlockingRules(categories);
    expect(rules.some((rule) => rule.pattern === 'gtag/js' && rule.type === 'script')).toBe(true);
    expect(rules.some((rule) => rule.pattern.includes('youtube.com/embed'))).toBe(true);
  });
});
