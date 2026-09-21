import { describe, expect, it } from 'vitest';
import { snapshotCategories } from '../src/consent/consent-response';

describe('Consent configuration', () => {
  it('snapshots categories for immutable policy versions', () => {
    const snapshot = snapshotCategories([
      {
        id: '1',
        slug: 'analytics',
        name: 'Analytics',
        description: 'Usage analytics',
        legalBasis: 'consent',
        defaultState: 'DISABLED',
        required: false,
        sortOrder: 1,
        isSystem: true,
        enabled: true,
        externalSignals: { google: ['analytics_storage'] },
        scriptMappings: { scripts: ['gtag.js'], cookies: ['_ga'] },
        vendorPurposes: ['measurement'],
      },
    ]);

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.slug).toBe('analytics');
    expect(snapshot[0]?.scriptMappings).toEqual({ scripts: ['gtag.js'], cookies: ['_ga'] });
  });
});
