import { describe, expect, it } from 'vitest';
import { resolveGeoRegulation, applyRegulationProfile } from './regional-rules';

describe('regional rules', () => {
  it('matches EU country to GDPR profile', () => {
    const resolved = resolveGeoRegulation(
      { country: 'DE', region: 'DE', language: 'de' },
      {
        enabled: true,
        defaultProfileId: 'generic_opt_in',
        regionalRules: [
          {
            id: 'eu',
            name: 'EU',
            priority: 10,
            conditions: { countryGroups: ['EU'] },
            profileId: 'gdpr',
          },
        ],
      },
    );
    expect(resolved.profileId).toBe('gdpr');
    expect(resolved.regulation).toBe('GDPR');
  });

  it('falls back to default profile when no rule matches', () => {
    const resolved = resolveGeoRegulation(
      { country: 'JP', region: 'JP', language: 'ja' },
      { enabled: true, defaultProfileId: 'generic_opt_out' },
    );
    expect(resolved.profileId).toBe('generic_opt_out');
  });

  it('applies opt-in category defaults from profile', () => {
    const { categories } = applyRegulationProfile(
      { title: 'Test' },
      [
        { slug: 'strictly_necessary', defaultState: 'ENABLED' },
        { slug: 'analytics', defaultState: 'ENABLED' },
      ],
      resolveGeoRegulation({ country: 'DE', region: 'DE', language: 'de' }, { enabled: true }).profile,
    );
    expect(categories?.find((c) => c.slug === 'analytics')?.defaultState).toBe('DISABLED');
  });

  it('matches California by US country + CA region, not all US visitors', () => {
    const settings = {
      enabled: true,
      defaultProfileId: 'generic_opt_in',
      regionalRules: [
        {
          id: 'us-ccpa',
          name: 'California',
          priority: 80,
          conditions: { countries: ['US'], regions: ['CA'] },
          profileId: 'ccpa',
        },
        {
          id: 'us-states',
          name: 'United States',
          priority: 70,
          conditions: { countryGroups: ['US'] },
          profileId: 'us_opt_out',
        },
      ],
    };

    const california = resolveGeoRegulation(
      { country: 'US', region: 'CA', language: 'en' },
      settings,
    );
    expect(california.profileId).toBe('ccpa');
    expect(california.regulation).toBe('CCPA');

    const texas = resolveGeoRegulation(
      { country: 'US', region: 'TX', language: 'en' },
      settings,
    );
    expect(texas.profileId).toBe('us_opt_out');

    const californiaByName = resolveGeoRegulation(
      { country: 'US', region: 'California', language: 'en' },
      settings,
    );
    expect(californiaByName.profileId).toBe('ccpa');
  });

  it('sets showDoNotSell on CCPA banners', () => {
    const { banner } = applyRegulationProfile(
      { title: 'Test', rejectButton: 'Reject all' },
      [{ slug: 'analytics', defaultState: 'DISABLED' }],
      resolveGeoRegulation(
        { country: 'US', region: 'CA', language: 'en' },
        {
          enabled: true,
          regionalRules: [
            {
              id: 'us-ccpa',
              name: 'California',
              priority: 80,
              conditions: { countries: ['US'], regions: ['CA'] },
              profileId: 'ccpa',
            },
          ],
        },
      ).profile,
    );
    expect((banner as { showDoNotSell?: boolean }).showDoNotSell).toBe(true);
    expect((banner as { doNotSellLabel?: string }).doNotSellLabel).toContain('Do Not Sell');
  });
});
