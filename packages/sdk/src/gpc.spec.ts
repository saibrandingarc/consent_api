import { describe, expect, it } from 'vitest';
import { isGlobalPrivacyControlEnabled } from './gpc';
import { shouldShowBanner } from './types';

describe('isGlobalPrivacyControlEnabled', () => {
  it('returns false when GPC is not set', () => {
    expect(isGlobalPrivacyControlEnabled()).toBe(false);
  });

  it('returns true when navigator.globalPrivacyControl is true', () => {
    Object.defineProperty(global.navigator, 'globalPrivacyControl', {
      configurable: true,
      value: true,
    });
    expect(isGlobalPrivacyControlEnabled()).toBe(true);
    Object.defineProperty(global.navigator, 'globalPrivacyControl', {
      configurable: true,
      value: undefined,
    });
  });
});

describe('shouldShowBanner with GPC', () => {
  it('hides banner when GPC is enabled and respect flag is on', () => {
    expect(
      shouldShowBanner({
        pathname: '/',
        hasStoredConsent: false,
        behavior: { respectGlobalPrivacyControl: true },
        gpcEnabled: true,
      }),
    ).toBe(false);
  });
});
