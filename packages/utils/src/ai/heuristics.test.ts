import {
  classifyCookieHeuristic,
  isSuspiciousNecessaryClassification,
  generateBannerTextHeuristic,
} from './heuristics';

describe('classifyCookieHeuristic', () => {
  it('classifies Google Analytics cookies', () => {
    const hint = classifyCookieHeuristic('_ga');
    expect(hint?.category).toBe('analytics');
    expect(hint?.provider).toBe('Google Analytics');
    expect(hint!.confidence).toBeGreaterThan(80);
  });

  it('classifies consent cookies', () => {
    const hint = classifyCookieHeuristic('cmp_consent');
    expect(hint?.category).toBe('strictly_necessary');
  });

  it('returns null for unknown cookies', () => {
    expect(classifyCookieHeuristic('xyz_random_cookie')).toBeNull();
  });
});

describe('isSuspiciousNecessaryClassification', () => {
  it('flags _ga as suspicious when marked necessary', () => {
    expect(isSuspiciousNecessaryClassification('_ga', 'strictly_necessary')).toBe(true);
  });

  it('ignores analytics category', () => {
    expect(isSuspiciousNecessaryClassification('_ga', 'analytics')).toBe(false);
  });
});

describe('generateBannerTextHeuristic', () => {
  it('generates CCPA-aware copy', () => {
    const text = generateBannerTextHeuristic({ regulation: 'CCPA', tone: 'professional' });
    expect(text.description).toContain('reject');
    expect(text.legalNotice).toContain('CCPA');
  });
});
