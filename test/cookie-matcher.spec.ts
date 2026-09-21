import { describe, expect, it } from 'vitest';
import type { CookieDefinition } from '@cmp/database';
import { matchCookieDefinition, reviewStatusForMatch } from '../src/cookies/cookie-matcher';

const gaDefinition = {
  id: 'def-ga',
  organizationId: null,
  cookieName: '_ga',
  provider: 'Google Analytics',
  providerDomain: 'google-analytics.com',
  description: 'Analytics cookie',
  purpose: 'Analytics',
  category: 'analytics',
  duration: '2 years',
  dataCollected: null,
  isThirdParty: true,
  privacyPolicyUrl: null,
  riskLevel: 'MEDIUM' as const,
  aliases: ['_ga_*'],
  detectionPatterns: {
    exact: ['_ga'],
    prefix: ['_ga_'],
    providerDomains: ['google-analytics.com'],
  },
  isSystem: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies CookieDefinition;

describe('cookie matcher', () => {
  it('matches exact and prefix cookie names', () => {
    const exact = matchCookieDefinition([gaDefinition], { cookieName: '_ga' });
    expect(exact?.confidence).toBe(100);
    expect(exact?.category).toBe('analytics');

    const prefix = matchCookieDefinition([gaDefinition], { cookieName: '_ga_ABC123' });
    expect(prefix?.matchMethod).toBe('PREFIX');
    expect(prefix?.confidence).toBe(90);
  });

  it('marks high-confidence matches as auto matched', () => {
    expect(reviewStatusForMatch(100)).toBe('AUTO_MATCHED');
    expect(reviewStatusForMatch(70)).toBe('PENDING');
  });
});
