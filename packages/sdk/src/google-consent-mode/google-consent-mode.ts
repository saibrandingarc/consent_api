import type { CmpConfig } from '../types';
import { buildDefaultSignals, mapConsentToGoogleSignals } from './mapping';
import type {
  GoogleConsentModeConfig,
  GoogleConsentModeDiagnostics,
  GoogleConsentSignals,
} from './types';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export class GoogleConsentModeController {
  private readonly config: GoogleConsentModeConfig;
  private defaultApplied = false;
  private updateApplied = false;
  private lastSignals: GoogleConsentSignals | null = null;

  constructor(
    cmpConfig: CmpConfig,
    private readonly getConsent: () => Record<string, boolean>,
    private readonly getRegion: () => string | null | undefined = () => cmpConfig.region,
  ) {
    const regulation = cmpConfig.regulationConfig as { googleConsentMode?: GoogleConsentModeConfig } | null;
    this.config = {
      enabled: true,
      mode: 'advanced',
      ...regulation?.googleConsentMode,
    };
  }

  isEnabled() {
    return Boolean(this.config.enabled);
  }

  installDefault() {
    if (!this.isEnabled()) return;

    this.ensureGtagStub();

    const defaults = buildDefaultSignals(
      this.getConsent(),
      this.getRegion(),
      this.config.regionDefaults,
    );

    const defaultOptions: Record<string, unknown> = {
      ...defaults,
      wait_for_update: this.config.waitForUpdate ?? 500,
    };

    if (this.config.adsDataRedaction) {
      defaultOptions.ads_data_redaction = true;
    }
    if (this.config.urlPassthrough) {
      defaultOptions.url_passthrough = true;
    }

    window.gtag!('consent', 'default', defaultOptions);
    this.defaultApplied = true;
    this.lastSignals = defaults;
    this.pushDataLayerEvent('cmp_consent_default', defaults);
  }

  update() {
    if (!this.isEnabled()) return;

    this.ensureGtagStub();
    const signals = mapConsentToGoogleSignals(this.getConsent());
    window.gtag!('consent', 'update', signals);
    this.updateApplied = true;
    this.lastSignals = signals;
    this.pushDataLayerEvent('cmp_consent_update', signals);
    document.dispatchEvent(new CustomEvent('cmp:google-consent-update', { detail: signals }));
  }

  getDiagnostics(): GoogleConsentModeDiagnostics {
    return {
      enabled: this.isEnabled(),
      defaultApplied: this.defaultApplied,
      updateApplied: this.updateApplied,
      mode: this.config.mode ?? 'advanced',
      lastSignals: this.lastSignals,
      gtagAvailable: typeof window.gtag === 'function',
      dataLayerAvailable: Array.isArray(window.dataLayer),
    };
  }

  private ensureGtagStub() {
    if (typeof window.gtag === 'function') return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }

  private pushDataLayerEvent(event: string, signals: GoogleConsentSignals) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event,
      cmp_consent_mode: this.config.mode ?? 'advanced',
      cmp_consent_signals: { ...signals },
    });
  }
}
