/** Heuristic cookie classification patterns (Sprint 18 — works without external LLM). */

export interface CookieClassificationHint {
  category: string;
  provider?: string;
  purpose?: string;
  description?: string;
  visitorDescription?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: string[];
}

const PATTERNS: Array<{
  test: (name: string, domain?: string | null) => boolean;
  hint: Omit<CookieClassificationHint, 'confidence' | 'evidence'>;
  confidence: number;
  evidence: string;
}> = [
  {
    test: (n) => /^_ga/.test(n) || n === '_gid' || n === '_gat',
    hint: {
      category: 'analytics',
      provider: 'Google Analytics',
      purpose: 'Analytics measurement',
      description: 'Google Analytics identifier used to distinguish users.',
      visitorDescription: 'Helps us understand how visitors use our website.',
      riskLevel: 'medium',
    },
    confidence: 92,
    evidence: 'Cookie name matches Google Analytics pattern',
  },
  {
    test: (n) => /^_fbp$/.test(n) || /^fr$/.test(n),
    hint: {
      category: 'marketing',
      provider: 'Meta',
      purpose: 'Advertising and conversion tracking',
      description: 'Meta (Facebook) pixel/browser identifier for ad delivery.',
      visitorDescription: 'Used to deliver and measure advertising.',
      riskLevel: 'high',
    },
    confidence: 90,
    evidence: 'Cookie name matches Meta advertising pattern',
  },
  {
    test: (n) => n.startsWith('__cf') || n === 'cf_clearance',
    hint: {
      category: 'strictly_necessary',
      provider: 'Cloudflare',
      purpose: 'Security and CDN',
      description: 'Cloudflare security and performance cookie.',
      visitorDescription: 'Required for site security and performance.',
      riskLevel: 'low',
    },
    confidence: 88,
    evidence: 'Cloudflare cookie prefix',
  },
  {
    test: (n) => n.includes('session') || n === 'PHPSESSID' || n === 'JSESSIONID',
    hint: {
      category: 'strictly_necessary',
      provider: 'Application',
      purpose: 'Session management',
      description: 'Maintains user session state across page requests.',
      visitorDescription: 'Keeps you logged in during your visit.',
      riskLevel: 'low',
    },
    confidence: 85,
    evidence: 'Session cookie naming convention',
  },
  {
    test: (n) => n.startsWith('cmp_') || n.includes('consent'),
    hint: {
      category: 'strictly_necessary',
      provider: 'CMP',
      purpose: 'Consent storage',
      description: 'Stores your cookie consent preferences.',
      visitorDescription: 'Remembers your privacy choices.',
      riskLevel: 'low',
    },
    confidence: 95,
    evidence: 'Consent management cookie pattern',
  },
  {
    test: (n) => /^_gcl_/.test(n),
    hint: {
      category: 'marketing',
      provider: 'Google Ads',
      purpose: 'Conversion tracking',
      description: 'Google Ads conversion linker cookie.',
      visitorDescription: 'Used to measure ad campaign performance.',
      riskLevel: 'high',
    },
    confidence: 91,
    evidence: 'Google Ads cookie prefix',
  },
];

const NECESSARY_SUSPICIOUS = [
  /^_ga/,
  /^_fb/,
  /^_gcl/,
  /ads?/i,
  /track/i,
  /pixel/i,
];

export function classifyCookieHeuristic(
  cookieName: string,
  cookieDomain?: string | null,
): CookieClassificationHint | null {
  const name = cookieName.trim();
  for (const entry of PATTERNS) {
    if (entry.test(name, cookieDomain)) {
      return {
        ...entry.hint,
        confidence: entry.confidence,
        evidence: [entry.evidence],
      };
    }
  }
  return null;
}

export function isSuspiciousNecessaryClassification(
  cookieName: string,
  category: string | null | undefined,
): boolean {
  if (category !== 'strictly_necessary') return false;
  return NECESSARY_SUSPICIOUS.some((re) => re.test(cookieName));
}

export function generateBannerTextHeuristic(input: {
  regulation?: string | null;
  industry?: string | null;
  tone?: string | null;
  language?: string | null;
}) {
  const regulation = input.regulation ?? 'GDPR';
  const tone = input.tone ?? 'professional';
  const title =
    tone === 'friendly'
      ? 'We value your privacy'
      : 'Cookie and privacy preferences';
  const description =
    regulation === 'CCPA'
      ? 'We use cookies and similar technologies. You can accept all, reject non-essential cookies, or customize your choices.'
      : 'We use cookies to provide essential functionality, analyze traffic, and personalize content. You can change your preferences at any time.';
  return {
    title,
    description,
    acceptButton: 'Accept all',
    rejectButton: 'Reject all',
    preferencesButton: 'Manage preferences',
    saveButton: 'Save choices',
    legalNotice: `Your choices apply under ${regulation}. See our privacy policy for details.`,
    confidence: 75,
    evidence: [`Generated from regulation=${regulation}, tone=${tone}`],
  };
}
