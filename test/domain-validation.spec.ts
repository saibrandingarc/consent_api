import { describe, expect, it } from 'vitest';
import { createDomainSchema } from '@cmp/validation';
import {
  buildInstallationChecks,
  summarizeChecks,
} from '../src/domains/installation-checks';

describe('Domain validation', () => {
  it('accepts valid hostnames', () => {
    expect(createDomainSchema.safeParse({ hostname: 'example.com' }).success).toBe(true);
    expect(createDomainSchema.safeParse({ hostname: 'app.example.co.uk' }).success).toBe(true);
  });

  it('rejects invalid hostnames', () => {
    expect(createDomainSchema.safeParse({ hostname: 'not a domain' }).success).toBe(false);
    expect(createDomainSchema.safeParse({ hostname: 'http://bad.com' }).success).toBe(false);
  });
});

describe('Installation checks', () => {
  const baseDomain = {
    domainKey: 'dk_test',
    verificationStatus: 'VERIFIED',
    autoBlocking: true,
    isProduction: true,
    environment: 'production',
    hasPublishedPolicy: true,
    sdkLastSeenAt: new Date('2026-01-01T00:00:00Z'),
    sdkLastHeartbeat: {
      scriptLoaded: true,
      scriptLoadedFirst: true,
      defaultConsentApplied: true,
      autoBlockingEnabled: true,
      googleConsentModeEnabled: false,
      duplicateScripts: 1,
      jsErrors: [],
    },
  };

  it('returns PASS when heartbeat data is healthy', () => {
    const checks = buildInstallationChecks(baseDomain);
    expect(summarizeChecks(checks)).toBe('WARNING');
    expect(checks.find((c) => c.id === 'cmp_script_detected')?.status).toBe('PASS');
    expect(checks.find((c) => c.id === 'duplicate_scripts')?.status).toBe('PASS');
  });

  it('fails production config when domain is unverified', () => {
    const checks = buildInstallationChecks({
      ...baseDomain,
      verificationStatus: 'PENDING',
    });
    expect(checks.find((c) => c.id === 'domain_verified')?.status).toBe('FAIL');
    expect(summarizeChecks(checks)).toBe('FAIL');
  });

  it('fails when CMP script has not reported', () => {
    const checks = buildInstallationChecks({
      ...baseDomain,
      sdkLastSeenAt: null,
      sdkLastHeartbeat: null,
    });
    expect(checks.find((c) => c.id === 'cmp_script_detected')?.status).toBe('FAIL');
    expect(summarizeChecks(checks)).toBe('FAIL');
  });

  it('warns on duplicate scripts', () => {
    const checks = buildInstallationChecks({
      ...baseDomain,
      sdkLastHeartbeat: {
        ...baseDomain.sdkLastHeartbeat,
        duplicateScripts: 3,
      },
    });
    expect(checks.find((c) => c.id === 'duplicate_scripts')?.status).toBe('WARNING');
  });
});
