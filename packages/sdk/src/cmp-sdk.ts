import type { BannerHandle } from './banner-renderer';
import { renderBanner } from './banner-renderer';
import { buildConsentChecksum } from './checksum';
import { clearConsent, loadConsent, saveConsent, wasExpiredConsent } from './consent-store';
import { isGlobalPrivacyControlEnabled } from './gpc';
import { mountPrivacyTrigger, type PrivacyTriggerHandle } from './privacy-trigger';
import { buildPolicySnapshot, deriveVendorSelections } from './policy-snapshot';
import { detectClientGeoHints } from './region';
import { setDefaultCookieDomain } from './storage';
import {
  buildConsentState,
  shouldShowBanner,
  type CategorySnapshot,
  type CmpConfig,
  type ConsentMetadata,
} from './types';
import { mountCookieDeclaration, type CookieDeclarationHandle } from './cookie-declaration';
import {
  getOrCreateVisitorId,
  saveVisitorVerificationToken,
  type VisitorIdentity,
  type VisitorOptions,
} from './visitor-id';
import { ManualBlockingController } from './blocking/manual-blocking';
import { AutomaticBlockingController } from './blocking/automatic-blocking';
import { GoogleConsentModeController } from './google-consent-mode/google-consent-mode';
import {
  applyBannerTranslation,
  applyCategoryTranslations,
  findTranslationEntry,
  normalizeLanguageCode,
  readStoredLanguagePreference,
  readUrlLanguageParam,
  resolveLanguagePriority,
  writeStoredLanguagePreference,
} from './language';

export type ConsentCollectionMethod =
  | 'banner_accept_all'
  | 'banner_reject_all'
  | 'banner_custom'
  | 'api'
  | 'withdrawal'
  | 'gpc'
  | 'consent_expired';

type ConsentListener = (consent: Record<string, boolean>) => void;
type ReadyListener = (config: CmpConfig) => void;

interface ServerConsentRecord {
  consentId: string;
  visitorId: string;
  categories: Record<string, boolean>;
  configVersion: number;
  policyVersionId?: string | null;
  savedAt: string;
  expiresAt?: string | null;
  withdrawn?: boolean;
  verificationToken?: string;
}

export class CmpSdk {
  private rawConfig: CmpConfig | null = null;
  private config: CmpConfig | null = null;
  private bannerHandle: BannerHandle | null = null;
  private cookieDeclarationHandle: CookieDeclarationHandle | null = null;
  private privacyTrigger: PrivacyTriggerHandle | null = null;
  private visitor: VisitorIdentity | null = null;
  private consent: Record<string, boolean> = { strictly_necessary: true };
  private consentToken: string | null = null;
  private authenticatedUserId: string | null = null;
  private blocking: AutomaticBlockingController | null = null;
  private googleConsentMode: GoogleConsentModeController | null = null;
  private ready = false;
  private readonly readyListeners = new Set<ReadyListener>();
  private readonly changeListeners = new Set<ConsentListener>();
  private forcedLanguage: string | null = null;

  constructor(
    private readonly domainKey: string,
    private readonly apiBase: string,
    private readonly debug = false,
    private readonly options?: { previewCountry?: string | null; scriptLanguage?: string | null },
  ) {}

  async init() {
    const result = await this.fetchConfig();
    if (!result.ok || !result.data) {
      if (this.debug) console.warn('[CMP] Config unavailable', result);
      return;
    }

    await this.applyConfig(result.data as CmpConfig);
  }

  private async fetchConfig() {
    const hints = detectClientGeoHints();
    const params = new URLSearchParams();
    if (this.options?.previewCountry) {
      params.set('previewCountry', this.options.previewCountry);
    }
    if (hints.country) params.set('clientCountry', hints.country);
    if (hints.region) params.set('clientRegion', hints.region);
    params.set('clientLanguage', hints.language);
    if (hints.timezone) params.set('clientTimezone', hints.timezone);
    const query = params.toString();
    const url = `${this.apiBase}/config/${encodeURIComponent(this.domainKey)}${query ? `?${query}` : ''}`;
    const response = await fetch(url);
    return response.json() as Promise<{ ok?: boolean; data?: CmpConfig; error?: { code?: string } }>;
  }

  private async applyConfig(config: CmpConfig) {
    this.rawConfig = config;
    this.config = this.localizeConfig(config);
    if (config.visitorCookieDomain) {
      setDefaultCookieDomain(config.visitorCookieDomain);
    }
    this.visitor = getOrCreateVisitorId(this.visitorOptions());
    const syncedFromGroup = await this.trySyncCrossDomainConsent();
    if (!syncedFromGroup) {
      await this.restoreStoredConsent();
    } else {
      this.emitConsentChanged();
    }
    this.seedRuntimeConsentFromDefaults();
    this.initGoogleConsentModeDefault();
    this.initBlocking();
    this.ready = true;
    this.emitReady();
    this.maybeApplyGpc();
    this.maybeShowBanner();
    this.mountPrivacyTrigger();
    document.dispatchEvent(new CustomEvent('cmp:ready', { detail: this.config }));
  }

  private initGoogleConsentModeDefault() {
    if (!this.config) return;
    this.googleConsentMode = new GoogleConsentModeController(
      this.config,
      () => this.consent,
      () => this.config?.region,
    );
    this.googleConsentMode.installDefault();
  }

  getGoogleConsentModeDiagnostics() {
    return this.googleConsentMode?.getDiagnostics() ?? null;
  }

  private getVisitorRegionInfo() {
    if (this.config?.visitorGeo) {
      return {
        region: this.config.visitorGeo.region ?? this.config.region ?? null,
        language: this.config.visitorGeo.language,
        timezone: this.config.visitorGeo.timezone,
        country: this.config.visitorGeo.country,
      };
    }
    return detectClientGeoHints(this.config?.region);
  }

  private initBlocking() {
    if (!this.config?.autoBlocking) return;
    this.blocking?.destroy();
    this.blocking = new AutomaticBlockingController(
      this.config,
      () => this.consent,
      () => this.openPreferences(),
      (violations) => this.reportBlockingViolations(violations),
    );
    this.blocking.start();
  }

  private reportBlockingViolations(violations: Record<string, unknown>[]) {
    if (!this.config || violations.length === 0) return;
    void fetch(`${this.apiBase}/violations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domainKey: this.domainKey,
        violations,
      }),
    }).catch(() => undefined);
  }

  private visitorOptions(): VisitorOptions {
    return {
      domainKey: this.domainKey,
      sharedCookieDomain: this.config?.shareVisitorAcrossSubdomains
        ? this.config.visitorCookieDomain ?? null
        : null,
    };
  }

  getConsent() {
    return { ...this.consent };
  }

  hasConsent(category: string) {
    return Boolean(this.consent[category]);
  }

  getPolicyVersion() {
    return {
      policyVersionId: this.config?.policyVersionId ?? null,
      policyVersionNumber: this.config?.policyVersionNumber ?? null,
      configVersion: this.config?.configVersion ?? null,
    };
  }

  getConsentToken() {
    if (this.consentToken) return this.consentToken;
    if (!this.config) return null;
    const stored = loadConsent(this.domainKey, this.config.configVersion);
    return stored?.consentToken ?? null;
  }

  getVisitorId() {
    return this.visitor?.visitorId ?? null;
  }

  getConfig() {
    return this.config;
  }

  getConsentMetadata(): ConsentMetadata | null {
    if (!this.config) return null;
    const stored = loadConsent(this.domainKey, this.config.configVersion);
    if (!stored) return null;
    return {
      savedAt: stored.savedAt ? new Date(stored.savedAt).toISOString() : null,
      expiresAt: stored.expiresAt ? new Date(stored.expiresAt).toISOString() : null,
      policyVersionId: stored.policyVersionId ?? this.config.policyVersionId ?? null,
      policyVersionNumber: stored.policyVersionNumber ?? this.config.policyVersionNumber ?? null,
      region: stored.region ?? this.config.region ?? null,
      language: stored.language ?? this.getActiveLanguage(),
    };
  }

  getActiveLanguage() {
    return this.config?.activeLanguage ?? this.config?.defaultLanguage ?? 'en';
  }

  setLanguage(language: string) {
    if (!this.rawConfig) return;
    const normalized = normalizeLanguageCode(language);
    this.forcedLanguage = normalized;
    writeStoredLanguagePreference(this.domainKey, normalized);
    this.config = this.localizeConfig(this.rawConfig, normalized);
    this.mountPrivacyTrigger();
    const bannerVisible = this.bannerHandle !== null;
    if (bannerVisible) {
      this.showBanner();
    }
    document.dispatchEvent(
      new CustomEvent('cmp:language-changed', { detail: { language: normalized } }),
    );
  }

  private resolveActiveLanguage(config: CmpConfig): string {
    const hints = this.getVisitorRegionInfo();
    return resolveLanguagePriority({
      urlParam: readUrlLanguageParam(),
      storedPreference: readStoredLanguagePreference(this.domainKey),
      scriptAttribute: this.options?.scriptLanguage,
      browserLanguage: hints.language,
      defaultLanguage: config.defaultLanguage ?? config.supportedLanguages?.[0] ?? 'en',
      supportedLanguages: config.supportedLanguages ?? ['en'],
    });
  }

  private localizeConfig(config: CmpConfig, forcedLanguage?: string): CmpConfig {
    const activeLanguage = forcedLanguage ?? this.forcedLanguage ?? this.resolveActiveLanguage(config);
    const supported = config.supportedLanguages ?? ['en'];
    const picked = normalizeLanguageCode(
      supported.includes(activeLanguage)
        ? activeLanguage
        : resolveLanguagePriority({
            urlParam: activeLanguage,
            defaultLanguage: config.defaultLanguage ?? supported[0] ?? 'en',
            supportedLanguages: supported,
          }),
    );

    let banner = config.banner;
    let categories = config.categories;

    if (banner && picked !== normalizeLanguageCode(config.defaultLanguage ?? 'en')) {
      const translation = findTranslationEntry(banner.translations, picked);
      banner = applyBannerTranslation(banner, picked) as CmpConfig['banner'];
      categories = applyCategoryTranslations(categories, translation);
    } else if (banner?.translations) {
      const { translations: _omit, ...withoutTranslations } = banner;
      banner = withoutTranslations as CmpConfig['banner'];
    }

    return {
      ...config,
      banner,
      categories,
      activeLanguage: picked,
    };
  }

  getBlockingViolationCount() {
    return this.blocking?.getViolationCount() ?? 0;
  }

  getVisitorVerificationToken() {
    return this.visitor?.verificationToken ?? null;
  }

  setAuthenticatedUserId(userId: string | null) {
    this.authenticatedUserId = userId;
  }

  onConsentReady(listener: ReadyListener) {
    if (this.ready && this.config) listener(this.config);
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  onConsentChanged(listener: ConsentListener) {
    listener({ ...this.consent });
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  acceptAll() {
    return this.applyConsent(buildConsentState(this.categories(), 'accept_all'), 'banner_accept_all');
  }

  rejectAll() {
    return this.applyConsent(buildConsentState(this.categories(), 'reject_all'), 'banner_reject_all');
  }

  /** CCPA/CPRA-style opt-out of sale/share (rejects optional categories). */
  doNotSellOrShare() {
    return this.applyConsent(buildConsentState(this.categories(), 'reject_all'), 'banner_reject_all');
  }

  setConsent(categories: Record<string, boolean>) {
    const validated = this.validateCategories(categories);
    return this.applyConsent(validated, 'api');
  }

  withdrawConsent() {
    const behavior = this.config?.banner?.behavior;
    if (behavior?.clearCookiesOnWithdrawal) {
      clearConsent(this.domainKey);
    }
    const withdrawn = buildConsentState(this.categories(), 'reject_all');
    return this.applyConsent(withdrawn, 'withdrawal');
  }

  openPreferences() {
    const config = this.bannerConfig();
    if (!config?.banner) return;
    this.bannerHandle?.destroy();
    this.bannerHandle = renderBanner(
      config,
      (consent) => this.applyConsent(consent, 'banner_custom'),
      { initialConsent: this.getConsent() },
    );
    this.bannerHandle?.openPreferences();
  }

  showBanner() {
    const config = this.bannerConfig();
    if (!config?.banner) return;
    this.bannerHandle?.destroy();
    this.bannerHandle = renderBanner(
      config,
      (consent) => this.applyConsent(consent, 'banner_custom'),
      { initialConsent: this.getConsent() },
    );
    this.bannerHandle?.show();
  }

  openCookieDeclaration(target?: HTMLElement | string) {
    let container: HTMLElement | null = null;
    if (typeof target === 'string') {
      container = document.querySelector<HTMLElement>(target);
    } else if (target instanceof HTMLElement) {
      container = target;
    }

    this.cookieDeclarationHandle?.destroy();

    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-cmp-cookie-declaration-modal', 'true');
      document.body.appendChild(container);
    }

    this.cookieDeclarationHandle = mountCookieDeclaration(container, {
      domainKey: this.domainKey,
      apiBase: this.apiBase,
      language: this.getActiveLanguage(),
      onClose: container.hasAttribute('data-cmp-cookie-declaration-modal')
        ? () => {
            this.cookieDeclarationHandle?.destroy();
            container?.remove();
            this.cookieDeclarationHandle = null;
          }
        : undefined,
    });
  }

  private bannerConfig(): CmpConfig | null {
    if (!this.config) return null;
    return {
      ...this.config,
      consentMetadata: this.getConsentMetadata(),
    };
  }

  hideBanner() {
    this.bannerHandle?.hide();
  }

  private categories(): CategorySnapshot[] {
    return (this.config?.categories ?? []).filter((category) => category.enabled !== false);
  }

  private validateCategories(categories: Record<string, boolean>) {
    const allowed = new Set(this.categories().map((category) => category.slug));
    const validated: Record<string, boolean> = {};
    for (const [slug, enabled] of Object.entries(categories)) {
      if (!allowed.has(slug)) continue;
      validated[slug] = enabled;
    }
    for (const category of this.categories()) {
      if (category.required || category.slug === 'strictly_necessary') {
        validated[category.slug] = true;
      } else if (!(category.slug in validated)) {
        validated[category.slug] = category.defaultState === 'ENABLED';
      }
    }
    return validated;
  }

  private async trySyncCrossDomainConsent(): Promise<boolean> {
    const group = this.config?.crossDomainGroup;
    if (!group?.shareConsent || !this.visitor) return false;

    try {
      const response = await fetch(`${this.apiBase}/consent/group-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainKey: this.domainKey,
          visitorId: this.visitor.visitorId,
          groupId: group.groupId,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        data?: {
          categories?: Record<string, boolean>;
          configVersion?: number;
          policyVersionId?: string | null;
          savedAt?: string;
          expiresAt?: string | null;
        } | null;
      };
      if (!result.ok || !result.data?.categories) return false;

      this.consent = this.validateCategories(result.data.categories);
      saveConsent(
        this.domainKey,
        {
          visitorId: this.visitor.visitorId,
          configVersion: result.data.configVersion ?? this.config!.configVersion,
          policyVersionId: result.data.policyVersionId ?? this.config!.policyVersionId ?? null,
          policyVersionNumber: this.config!.policyVersionNumber ?? null,
          categories: this.consent,
          savedAt: new Date(result.data.savedAt ?? Date.now()).getTime(),
          expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt).getTime() : null,
        },
        this.config!.banner?.behavior,
      );
      return true;
    } catch {
      return false;
    }
  }

  private async restoreStoredConsent() {
    if (!this.config) return;

    const local = loadConsent(this.domainKey, this.config.configVersion);
    if (local) {
      this.consent = local.categories;
      this.consentToken = local.consentToken ?? null;
      this.emitConsentChanged();
      return;
    }

    if (!this.visitor) return;

    const serverRecord = await this.fetchServerConsent(this.visitor.visitorId);
    if (!serverRecord) return;

    this.consent = serverRecord.categories;
    const savedAtMs = new Date(serverRecord.savedAt).getTime();
    const expiresAt = serverRecord.expiresAt ? new Date(serverRecord.expiresAt).getTime() : null;

    saveConsent(
      this.domainKey,
      {
        consentId: serverRecord.consentId,
        visitorId: serverRecord.visitorId,
        configVersion: serverRecord.configVersion,
        policyVersionId: serverRecord.policyVersionId ?? this.config.policyVersionId ?? null,
        policyVersionNumber: this.config.policyVersionNumber ?? null,
        categories: serverRecord.categories,
        expiresAt,
        savedAt: savedAtMs,
        verificationToken: serverRecord.verificationToken,
      },
      this.config.banner?.behavior,
    );

    if (serverRecord.verificationToken) {
      this.visitor = saveVisitorVerificationToken(this.visitorOptions(), serverRecord.verificationToken);
    }

    this.emitConsentChanged();
  }

  private async fetchServerConsent(visitorId: string): Promise<ServerConsentRecord | null> {
    try {
      const response = await fetch(
        `${this.apiBase}/consent/${encodeURIComponent(this.domainKey)}/${encodeURIComponent(visitorId)}`,
      );
      const result = await response.json();
      if (!result.ok || !result.data) return null;

      const record = result.data as ServerConsentRecord;
      if (!this.config || record.configVersion !== this.config.configVersion) return null;
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;
      return record;
    } catch {
      if (this.debug) console.warn('[CMP] Failed to restore consent from server');
      return null;
    }
  }

  private seedRuntimeConsentFromDefaults() {
    if (!this.config) return;
    if (loadConsent(this.domainKey, this.config.configVersion)) return;
    // Opt-out profiles use ENABLED defaults; apply them so scripts are not blocked like opt-in.
    this.consent = buildConsentState(this.categories(), 'custom');
    this.emitConsentChanged();
  }

  private maybeApplyGpc() {
    if (!this.config) return;
    const behavior = this.config.banner?.behavior ?? {};
    if (!behavior.respectGlobalPrivacyControl || !isGlobalPrivacyControlEnabled()) return;
    if (loadConsent(this.domainKey, this.config.configVersion)) return;
    void this.applyConsent(buildConsentState(this.categories(), 'reject_all'), 'gpc');
  }

  private maybeShowBanner() {
    if (!this.config?.banner) return;
    const stored = loadConsent(this.domainKey, this.config.configVersion);
    const show = shouldShowBanner({
      pathname: location.pathname,
      behavior: this.config.banner.behavior,
      hasStoredConsent: Boolean(stored),
      requiresRenewal: this.config.requiresRenewal,
      gpcEnabled: isGlobalPrivacyControlEnabled(),
    });
    if (!show) return;

    const launch = () => this.showBanner();
    const behavior = this.config.banner.behavior ?? {};
    const delay = behavior.displayDelayMs ?? 0;
    const scrollPercent = behavior.displayAfterScrollPercent ?? 0;

    const schedule = () => {
      if (scrollPercent > 0) {
        const onScroll = () => {
          const scrolled =
            (window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100;
          if (scrolled >= scrollPercent) {
            window.removeEventListener('scroll', onScroll);
            launch();
          }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return;
      }
      if (delay > 0) window.setTimeout(launch, delay);
      else launch();
    };

    if (behavior.displayAfterInteraction) {
      const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'scroll', 'touchstart'];
      const handler = () => {
        events.forEach((event) => window.removeEventListener(event, handler));
        schedule();
      };
      events.forEach((event) => window.addEventListener(event, handler, { once: true, passive: true }));
      return;
    }
    schedule();
  }

  private mountPrivacyTrigger() {
    this.privacyTrigger?.destroy();
    if (!this.config) return;
    const stored = loadConsent(this.domainKey, this.config.configVersion);
    const showDoNotSell = Boolean(this.config.banner?.showDoNotSell);
    if (!stored && !showDoNotSell) return;
    const trigger = this.config.banner?.privacyTrigger;
    const dnsLabel =
      this.config.banner?.doNotSellLabel ?? 'Do Not Sell or Share My Personal Information';
    this.privacyTrigger = mountPrivacyTrigger(
      trigger,
      () => this.openPreferences(),
      showDoNotSell
        ? {
            label: dnsLabel,
            onDoNotSell: () => void this.doNotSellOrShare(),
          }
        : undefined,
    );
  }

  private async applyConsent(categories: Record<string, boolean>, method: ConsentCollectionMethod) {
    if (!this.config) return;
    this.consent = categories;
    this.visitor = getOrCreateVisitorId(this.visitorOptions());
    const regionInfo = this.getVisitorRegionInfo();
    const savedAt = new Date().toISOString();
    const behavior = this.config.banner?.behavior;
    const days = behavior?.rememberChoice === false ? 0 : (behavior?.consentExpirationDays ?? 365);
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

    let collectionMethod = method;
    if (
      method !== 'withdrawal' &&
      wasExpiredConsent(this.domainKey, this.config.configVersion)
    ) {
      collectionMethod = 'consent_expired';
    }

    const checksum = await buildConsentChecksum({
      visitorId: this.visitor.visitorId,
      configVersion: this.config.configVersion,
      categories,
      savedAt,
    });

    const categoryList = this.categories();
    const vendors = deriveVendorSelections(categoryList, categories);
    const policySnapshot = buildPolicySnapshot(
      this.config,
      regionInfo.region ?? null,
      regionInfo.language,
    );

    const submission = await this.submitConsentToServer({
      categories,
      method: collectionMethod,
      checksum,
      savedAt,
      expiresAt,
      region: regionInfo.region ?? undefined,
      language: regionInfo.language,
      regulation: this.config.applicableRegulation ?? undefined,
      vendors,
      policySnapshot,
    });

    saveConsent(
      this.domainKey,
      {
        consentId: submission?.consentId,
        visitorId: this.visitor.visitorId,
        configVersion: this.config.configVersion,
        policyVersionId: this.config.policyVersionId ?? null,
        policyVersionNumber: this.config.policyVersionNumber ?? null,
        categories,
        region: regionInfo.region,
        language: regionInfo.language,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        checksum,
        consentToken: submission?.consentToken,
        verificationToken: submission?.verificationToken,
      },
      behavior,
    );

    if (submission?.consentToken) {
      this.consentToken = submission.consentToken;
    }
    if (submission?.verificationToken) {
      this.visitor = saveVisitorVerificationToken(this.visitorOptions(), submission.verificationToken);
    }

    this.bannerHandle?.hide();
    this.mountPrivacyTrigger();
    this.emitConsentChanged();
    document.dispatchEvent(new CustomEvent('cmp:consent-update', { detail: categories }));
    if (method === 'withdrawal') {
      document.dispatchEvent(new CustomEvent('cmp:withdrawal', { detail: categories }));
    }
  }

  private async submitConsentToServer(input: {
    categories: Record<string, boolean>;
    method: ConsentCollectionMethod;
    checksum: string;
    savedAt: string;
    expiresAt: string | null;
    region?: string;
    language?: string;
    regulation?: string;
    vendors: Record<string, boolean>;
    policySnapshot: ReturnType<typeof buildPolicySnapshot>;
  }) {
    if (!this.config || !this.visitor) return null;
    try {
      const response = await fetch(`${this.apiBase}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainKey: this.domainKey,
          visitorId: this.visitor.visitorId,
          authenticatedUserId: this.authenticatedUserId,
          policyVersionId: this.config.policyVersionId ?? null,
          configVersion: this.config.configVersion,
          categories: input.categories,
          vendors: input.vendors,
          policySnapshot: input.policySnapshot,
          region: input.region,
          language: input.language,
          regulation: input.regulation,
          collectionMethod: input.method,
          checksum: input.checksum,
          savedAt: input.savedAt,
          expiresAt: input.expiresAt,
        }),
      });
      const result = await response.json();
      if (!result.ok || !result.data) return null;
      return result.data as {
        consentId: string;
        consentToken?: string;
        verificationToken?: string;
      };
    } catch {
      if (this.debug) console.warn('[CMP] Failed to submit consent to server');
      return null;
    }
  }

  private emitReady() {
    if (!this.config) return;
    this.readyListeners.forEach((listener) => listener(this.config!));
  }

  private emitConsentChanged() {
    const snapshot = { ...this.consent };
    if (this.googleConsentMode) {
      this.googleConsentMode.update();
    }
    if (this.blocking) {
      this.blocking.sync(snapshot);
    }
    this.changeListeners.forEach((listener) => listener(snapshot));
  }
}
