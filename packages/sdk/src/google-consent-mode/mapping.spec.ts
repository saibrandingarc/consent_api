import { describe, expect, it } from 'vitest';
import { buildDefaultSignals, mapConsentToGoogleSignals } from './mapping';

describe('google consent mode mapping', () => {
  it('maps analytics and marketing categories to v2 signals', () => {
    const signals = mapConsentToGoogleSignals({
      strictly_necessary: true,
      analytics: true,
      marketing: false,
    });
    expect(signals.analytics_storage).toBe('granted');
    expect(signals.ad_storage).toBe('denied');
    expect(signals.security_storage).toBe('granted');
  });

  it('applies region-specific defaults', () => {
    const signals = buildDefaultSignals(
      { analytics: false, marketing: false },
      'EU',
      { EU: { analytics_storage: 'denied', ad_storage: 'denied' } },
    );
    expect(signals.analytics_storage).toBe('denied');
    expect(signals.ad_storage).toBe('denied');
  });

  it('uses mapped consent when region has no regional default', () => {
    const signals = buildDefaultSignals(
      { analytics: true, marketing: false },
      'US',
      { EU: { analytics_storage: 'denied', ad_storage: 'denied' } },
    );
    expect(signals.analytics_storage).toBe('granted');
    expect(signals.ad_storage).toBe('denied');
  });
});
