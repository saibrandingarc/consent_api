export type ConsentSignalValue = 'granted' | 'denied';

export interface GoogleConsentSignals {
  analytics_storage: ConsentSignalValue;
  ad_storage: ConsentSignalValue;
  ad_user_data: ConsentSignalValue;
  ad_personalization: ConsentSignalValue;
  functionality_storage: ConsentSignalValue;
  personalization_storage: ConsentSignalValue;
  security_storage: ConsentSignalValue;
}

export interface GoogleConsentModeConfig {
  enabled?: boolean;
  mode?: 'basic' | 'advanced';
  adsDataRedaction?: boolean;
  urlPassthrough?: boolean;
  waitForUpdate?: number;
  regionDefaults?: Record<string, Partial<GoogleConsentSignals>>;
}

export interface GoogleConsentModeDiagnostics {
  enabled: boolean;
  defaultApplied: boolean;
  updateApplied: boolean;
  mode: 'basic' | 'advanced';
  lastSignals: GoogleConsentSignals | null;
  gtagAvailable: boolean;
  dataLayerAvailable: boolean;
}

export const DEFAULT_DENIED_SIGNALS: GoogleConsentSignals = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
};
