import { CmpSdk } from './cmp-sdk';
import { clearConsent } from './consent-store';
import { mountTestScripts } from './test-scripts';
import type { CmpConfig, ConsentMetadata } from './types';

declare global {
  interface Window {
    CMP?: CmpSdk;
    __CMP__?: {
      domainKey: string;
      env: string;
      ready: boolean;
      consent: Record<string, boolean>;
      showBanner?: () => void;
      hideBanner?: () => void;
      openPreferences?: () => void;
      openCookieDeclaration?: (target?: HTMLElement | string) => void;
      setLanguage?: (language: string) => void;
      getActiveLanguage?: () => string;
      getConsent?: () => Record<string, boolean>;
      setConsent?: (categories: Record<string, boolean>) => void;
      acceptAll?: () => void;
      rejectAll?: () => void;
      doNotSellOrShare?: () => void;
      withdrawConsent?: () => void;
      setAuthenticatedUserId?: (userId: string | null) => void;
      hasConsent?: (category: string) => boolean;
      getVisitorId?: () => string | null;
      getPolicyVersion?: () => {
        policyVersionId: string | null;
        policyVersionNumber: number | null;
        configVersion: number | null;
      };
      getConsentToken?: () => string | null;
      getVisitorVerificationToken?: () => string | null;
      getConsentMetadata?: () => ConsentMetadata | null;
      getConfig?: () => CmpConfig | null;
      getGoogleConsentModeDiagnostics?: () => Record<string, unknown> | null;
      onConsentReady?: (listener: (config: CmpConfig) => void) => () => void;
      onConsentChanged?: (listener: (consent: Record<string, boolean>) => void) => () => void;
    };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function getApiBase(script: HTMLScriptElement | null) {
  const src = script?.getAttribute('src') ?? '';
  return src.replace(/\/sdk\.js(?:\?.*)?$/, '');
}

function sendHeartbeat(apiBase: string, payload: Record<string, unknown>) {
  return fetch(`${apiBase}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

/** Next.js and other loaders inject sdk.js without a reliable document.currentScript. */
export function findCmpScript(): HTMLScriptElement | null {
  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.getAttribute('data-domain-key')) return current;

  const byId = document.getElementById('cmp-sdk');
  if (byId?.getAttribute('data-domain-key')) return byId as HTMLScriptElement;

  const matches = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[data-domain-key]'),
  ).filter((node) => /\/sdk\.js(?:\?.*)?$/.test(node.src));

  if (matches.length === 1) return matches[0]!;
  return matches[0] ?? null;
}

export function initFromScript() {
  const script = findCmpScript();
  const domainKey = script?.getAttribute('data-domain-key');
  const env = script?.getAttribute('data-env') ?? 'production';
  const debug = script?.getAttribute('data-debug') === 'true';
  if (!domainKey) {
    console.error('[CMP] Missing data-domain-key');
    return;
  }

  const apiBase = getApiBase(script);
  const previewCountry = script?.getAttribute('data-preview-country') ?? undefined;
  const scriptLanguage = script?.getAttribute('data-lang') ?? undefined;
  const integrationSource = script?.getAttribute('data-integration') ?? undefined;
  const sdk = new CmpSdk(domainKey, apiBase, debug, { previewCountry, scriptLanguage });
  window.CMP = sdk;

  window.__CMP__ = {
    domainKey,
    env,
    ready: false,
    consent: { strictly_necessary: true },
    getConsent: () => sdk.getConsent(),
    setConsent: (categories) => sdk.setConsent(categories),
    acceptAll: () => sdk.acceptAll(),
    rejectAll: () => sdk.rejectAll(),
    doNotSellOrShare: () => sdk.doNotSellOrShare(),
    withdrawConsent: () => sdk.withdrawConsent(),
    setAuthenticatedUserId: (userId: string | null) => sdk.setAuthenticatedUserId(userId),
    hasConsent: (category) => sdk.hasConsent(category),
    getVisitorId: () => sdk.getVisitorId(),
    getPolicyVersion: () => sdk.getPolicyVersion(),
    getConsentToken: () => sdk.getConsentToken(),
    getVisitorVerificationToken: () => sdk.getVisitorVerificationToken(),
    getConsentMetadata: () => sdk.getConsentMetadata(),
    getConfig: () => sdk.getConfig(),
    getGoogleConsentModeDiagnostics: () => sdk.getGoogleConsentModeDiagnostics(),
    onConsentReady: (listener) => sdk.onConsentReady(listener),
    onConsentChanged: (listener) => sdk.onConsentChanged(listener),
    showBanner: () => sdk.showBanner(),
    hideBanner: () => sdk.hideBanner(),
    openPreferences: () => sdk.openPreferences(),
    openCookieDeclaration: (target) => sdk.openCookieDeclaration(target),
    setLanguage: (language: string) => sdk.setLanguage(language),
    getActiveLanguage: () => sdk.getActiveLanguage(),
  };

  sdk.onConsentReady(() => {
    if (!window.__CMP__) return;
    window.__CMP__.ready = true;
    window.__CMP__.consent = sdk.getConsent();
  });

  sdk.onConsentChanged((consent) => {
    if (!window.__CMP__) return;
    window.__CMP__.consent = consent;
  });

  mountTestScripts(script, sdk);

  const jsErrors: string[] = [];
  window.addEventListener('error', (event) => {
    if (event.message) jsErrors.push(event.message);
  });

  void (async () => {
    await sdk.init();

    const gcm = sdk.getGoogleConsentModeDiagnostics();
    await sendHeartbeat(apiBase, {
      domainKey,
      hostname: location.hostname,
      integrationSource,
      scriptLoaded: true,
      consentEventDetected: false,
      autoBlockingEnabled: true,
      googleConsentModeDetected: Boolean(gcm?.gtagAvailable && gcm?.defaultApplied),
      googleConsentModeEnabled: gcm?.enabled ?? true,
      googleConsentModeDefaultApplied: gcm?.defaultApplied ?? false,
      googleConsentModeUpdateApplied: gcm?.updateApplied ?? false,
      googleConsentModeMode: gcm?.mode as 'basic' | 'advanced' | undefined,
      duplicateScripts: document.querySelectorAll(`script[data-domain-key="${domainKey}"]`).length,
      jsErrors: jsErrors.slice(0, 5),
      scriptLoadedFirst: true,
      defaultConsentApplied: true,
      preConsentViolations: sdk.getBlockingViolationCount(),
    });
  })();

  return {
    sdk,
    clearConsent: () => clearConsent(domainKey),
  };
}

if (typeof document !== 'undefined') {
  initFromScript();
}

export { CmpSdk } from './cmp-sdk';
export { buildConsentState, shouldShowBanner } from './types';
export type { ConsentMetadata } from './types';
export { loadConsent, saveConsent, clearConsent } from './consent-store';
export { renderBanner } from './banner-renderer';
export { mountCookieDeclaration } from './cookie-declaration';
export type { CookieDeclarationEntry, CookieDeclarationOptions, CookieDeclarationHandle } from './cookie-declaration';
export { isGlobalPrivacyControlEnabled } from './gpc';
export { getOrCreateVisitorId, rotateVisitorId } from './visitor-id';
export { detectVisitorRegion } from './region';
