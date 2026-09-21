import type { GoogleConsentSignals } from './types';
import { DEFAULT_DENIED_SIGNALS } from './types';

export function mapConsentToGoogleSignals(consent: Record<string, boolean>): GoogleConsentSignals {
  const analytics = Boolean(consent.analytics);
  const marketing = Boolean(consent.marketing);
  const functional = Boolean(consent.functional);
  const personalization = Boolean(consent.personalization);

  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
    functionality_storage: functional ? 'granted' : 'denied',
    personalization_storage: personalization ? 'granted' : 'denied',
    security_storage: 'granted',
  };
}

export function mergeRegionDefaults(
  region: string | null | undefined,
  regionDefaults?: Record<string, Partial<GoogleConsentSignals>>,
): Partial<GoogleConsentSignals> {
  if (!region || !regionDefaults) return {};
  const normalized = region.toUpperCase();
  return regionDefaults[normalized] ?? regionDefaults[region] ?? {};
}

export function buildDefaultSignals(
  consent: Record<string, boolean>,
  region?: string | null,
  regionDefaults?: Record<string, Partial<GoogleConsentSignals>>,
): GoogleConsentSignals {
  const mapped = mapConsentToGoogleSignals(consent);
  const regional = mergeRegionDefaults(region, regionDefaults);
  return { ...DEFAULT_DENIED_SIGNALS, ...mapped, ...regional };
}
