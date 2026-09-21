export interface ValidationCheck {
  id: string;
  label: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  message: string;
  remediation?: string;
}

export interface SdkHeartbeatPayload {
  scriptLoaded?: boolean;
  consentEventDetected?: boolean;
  autoBlockingEnabled?: boolean;
  googleConsentModeDetected?: boolean;
  googleConsentModeEnabled?: boolean;
  googleConsentModeDefaultApplied?: boolean;
  googleConsentModeUpdateApplied?: boolean;
  googleConsentModeMode?: 'basic' | 'advanced';
  duplicateScripts?: number;
  jsErrors?: string[];
  scriptLoadedFirst?: boolean;
  defaultConsentApplied?: boolean;
  preConsentViolations?: number;
  integrationSource?: 'wordpress' | 'gtm' | 'manual' | 'shopify' | 'other';
}

export interface DomainForValidation {
  domainKey: string;
  verificationStatus: string;
  autoBlocking: boolean;
  isProduction: boolean;
  environment: string;
  sdkLastSeenAt: Date | null;
  sdkLastHeartbeat: SdkHeartbeatPayload | null;
  hasPublishedPolicy?: boolean;
}

export function buildInstallationChecks(domain: DomainForValidation): ValidationCheck[] {
  const heartbeat = domain.sdkLastHeartbeat ?? {};
  const hasHeartbeat = Boolean(domain.sdkLastSeenAt);
  const isProduction =
    domain.isProduction && domain.environment === 'production';

  const checks: ValidationCheck[] = [
    {
      id: 'domain_key_valid',
      label: 'Domain key valid',
      status: domain.domainKey ? 'PASS' : 'FAIL',
      message: domain.domainKey ? 'Domain key is configured' : 'Domain key missing',
    },
    {
      id: 'cmp_script_detected',
      label: 'CMP script detected',
      status: hasHeartbeat ? 'PASS' : 'FAIL',
      message: hasHeartbeat
        ? `Last seen ${domain.sdkLastSeenAt!.toISOString()}`
        : 'CMP script has not reported installation',
      remediation: 'Install the CMP script snippet and visit your website',
    },
    {
      id: 'script_loaded_before_trackers',
      label: 'Script loaded before trackers',
      status: !hasHeartbeat
        ? 'FAIL'
        : heartbeat.scriptLoadedFirst
          ? 'PASS'
          : heartbeat.scriptLoaded
            ? 'WARNING'
            : 'FAIL',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : heartbeat.scriptLoadedFirst
          ? 'CMP script loads before known tracker scripts'
          : heartbeat.scriptLoaded
            ? 'CMP script loaded but may run after other scripts'
            : 'CMP script load order could not be verified',
      remediation: 'Place the CMP snippet as early as possible in <head>, before analytics tags',
    },
    {
      id: 'domain_verified',
      label: 'Domain ownership verified',
      status:
        domain.verificationStatus === 'VERIFIED'
          ? 'PASS'
          : isProduction
            ? 'FAIL'
            : 'WARNING',
      message:
        domain.verificationStatus === 'VERIFIED'
          ? 'Domain is verified'
          : isProduction
            ? 'Production domains must be verified before publishing'
            : 'Domain is not yet verified',
      remediation: 'Complete domain verification before publishing to production',
    },
    {
      id: 'banner_config_loaded',
      label: 'Banner configuration loaded',
      status: domain.hasPublishedPolicy ? 'PASS' : 'WARNING',
      message: domain.hasPublishedPolicy
        ? 'Published banner configuration is available'
        : 'No published banner configuration yet',
      remediation: 'Publish a consent policy with banner content',
    },
    {
      id: 'default_consent_state',
      label: 'Default consent state applied',
      status: !hasHeartbeat
        ? 'FAIL'
        : heartbeat.defaultConsentApplied
          ? 'PASS'
          : 'WARNING',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : heartbeat.defaultConsentApplied
          ? 'Default consent state is applied'
          : 'Default consent state was not confirmed by the SDK',
      remediation: 'Ensure the CMP script initializes before other tags run',
    },
    {
      id: 'consent_update_event',
      label: 'Consent update event detected',
      status: !hasHeartbeat
        ? 'FAIL'
        : heartbeat.consentEventDetected
          ? 'PASS'
          : 'WARNING',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : heartbeat.consentEventDetected
          ? 'Consent update events are being reported'
          : 'No consent update event detected yet (expected after user interaction)',
      remediation: 'Publish banner content and interact with the consent banner on your site',
    },
    {
      id: 'auto_blocking_enabled',
      label: 'Auto-blocking enabled',
      status:
        domain.autoBlocking && heartbeat.autoBlockingEnabled !== false
          ? 'PASS'
          : domain.autoBlocking
            ? 'WARNING'
            : 'WARNING',
      message: domain.autoBlocking
        ? heartbeat.autoBlockingEnabled === false
          ? 'Domain expects auto-blocking but SDK reported it disabled'
          : 'Auto-blocking is enabled'
        : 'Auto-blocking is disabled on this domain',
    },
    {
      id: 'pre_consent_violations',
      label: 'Pre-consent blocking violations',
      status: !hasHeartbeat
        ? 'FAIL'
        : (heartbeat.preConsentViolations ?? 0) === 0
          ? 'PASS'
          : 'WARNING',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : (heartbeat.preConsentViolations ?? 0) === 0
          ? 'No pre-consent tracker violations detected'
          : `${heartbeat.preConsentViolations} resource(s) blocked before consent`,
      remediation: 'Review blocking debugger output and remove or defer non-essential tags until consent',
    },
    {
      id: 'google_consent_mode',
      label: 'Google Consent Mode',
      status: !hasHeartbeat
        ? 'FAIL'
        : heartbeat.googleConsentModeEnabled === false
          ? 'PASS'
          : heartbeat.googleConsentModeDefaultApplied && heartbeat.googleConsentModeDetected
            ? heartbeat.googleConsentModeUpdateApplied
              ? 'PASS'
              : 'WARNING'
            : 'FAIL',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : heartbeat.googleConsentModeEnabled === false
          ? 'Google Consent Mode is disabled in policy'
          : heartbeat.googleConsentModeDefaultApplied && heartbeat.googleConsentModeDetected
            ? heartbeat.googleConsentModeUpdateApplied
              ? `Consent Mode v2 active (${heartbeat.googleConsentModeMode ?? 'advanced'}): default and update applied`
              : `Consent Mode v2 default applied (${heartbeat.googleConsentModeMode ?? 'advanced'}); awaiting visitor consent update`
            : 'Google Consent Mode default was not applied before tags — place CMP snippet before GTM/gtag',
      remediation:
        heartbeat.googleConsentModeEnabled === false
          ? undefined
          : 'Enable Google Consent Mode in policy settings and load the CMP script before Google tags',
    },
    {
      id: 'duplicate_scripts',
      label: 'Duplicate CMP scripts',
      status: !hasHeartbeat
        ? 'FAIL'
        : (heartbeat.duplicateScripts ?? 1) <= 1
          ? 'PASS'
          : 'WARNING',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : (heartbeat.duplicateScripts ?? 1) <= 1
          ? 'Single CMP script instance detected'
          : `${heartbeat.duplicateScripts} CMP script tags detected`,
      remediation: 'Remove duplicate CMP script tags from your site',
    },
    {
      id: 'js_errors',
      label: 'JavaScript errors detected',
      status: !hasHeartbeat
        ? 'FAIL'
        : (heartbeat.jsErrors?.length ?? 0) === 0
          ? 'PASS'
          : 'FAIL',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : (heartbeat.jsErrors?.length ?? 0) === 0
          ? 'No JavaScript errors reported by the SDK'
          : `${heartbeat.jsErrors!.length} JavaScript error(s) reported`,
      remediation: 'Fix JavaScript errors on your site and reload',
    },
    {
      id: 'integration_source',
      label: 'Integration source',
      status: !hasHeartbeat
        ? 'FAIL'
        : heartbeat.integrationSource
          ? 'PASS'
          : 'WARNING',
      message: !hasHeartbeat
        ? 'CMP script has not reported installation'
        : heartbeat.integrationSource
          ? `Integration reported: ${heartbeat.integrationSource}`
          : 'No integration source reported (manual snippet install)',
      remediation: 'Use the WordPress plugin, GTM template, or add data-integration on the script tag',
    },
  ];

  return checks;
}

export function summarizeChecks(checks: ValidationCheck[]): 'PASS' | 'WARNING' | 'FAIL' {
  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const warnCount = checks.filter((c) => c.status === 'WARNING').length;
  if (failCount > 0) return 'FAIL';
  if (warnCount > 0) return 'WARNING';
  return 'PASS';
}
