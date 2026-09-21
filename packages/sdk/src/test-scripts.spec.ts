import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CMP_TEST_SCRIPT_MARKERS, syncTestScripts } from './test-scripts';

describe('syncTestScripts', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    window.__CMP__ = {
      domainKey: 'dk_test',
      env: 'production',
      ready: true,
      consent: {},
      getConsent: () => window.__CMP__!.consent,
      hasConsent: (category: string) => Boolean(window.__CMP__!.consent[category]),
    };
  });

  afterEach(() => {
    delete window.__CMP__;
  });

  it('loads a test script marker for each optional category when consented', () => {
    window.__CMP__!.consent = {
      preferences: true,
      functional: true,
      analytics: true,
      performance: true,
      marketing: true,
      social_media: true,
      unclassified: true,
    };

    syncTestScripts();

    for (const markerId of Object.values(CMP_TEST_SCRIPT_MARKERS)) {
      expect(document.getElementById(markerId)).toBeTruthy();
    }
  });

  it('does not load category scripts without consent', () => {
    window.__CMP__!.consent = { analytics: true };

    syncTestScripts();

    expect(document.getElementById(CMP_TEST_SCRIPT_MARKERS.analytics)).toBeTruthy();
    expect(document.getElementById(CMP_TEST_SCRIPT_MARKERS.preferences)).toBeNull();
    expect(document.getElementById(CMP_TEST_SCRIPT_MARKERS.performance)).toBeNull();
    expect(document.getElementById(CMP_TEST_SCRIPT_MARKERS.unclassified)).toBeNull();
  });
});

declare global {
  interface Window {
    __CMP__?: {
      domainKey: string;
      env: string;
      ready: boolean;
      consent: Record<string, boolean>;
      getConsent: () => Record<string, boolean>;
      hasConsent: (category: string) => boolean;
    };
  }
}
