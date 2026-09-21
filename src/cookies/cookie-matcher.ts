import type { CookieDefinition, CookieDetectionPatterns } from '@cmp/database';

export const LOW_CONFIDENCE_THRESHOLD = 80;

export interface CookieMatchContext {
  cookieName: string;
  cookieDomain?: string | null;
  sourceUrl?: string | null;
  isThirdParty?: boolean | null;
}

export interface CookieMatchResult {
  definitionId: string;
  provider: string;
  providerDomain: string | null;
  description: string | null;
  purpose: string | null;
  category: string;
  duration: string | null;
  dataCollected: string | null;
  isThirdParty: boolean;
  privacyPolicyUrl: string | null;
  riskLevel: string;
  matchMethod: 'EXACT' | 'PREFIX' | 'SUFFIX' | 'REGEX' | 'PROVIDER_DOMAIN' | 'SCRIPT_SOURCE' | 'NETWORK_ENDPOINT' | 'VENDOR_SIGNATURE';
  confidence: number;
}

function parsePatterns(value: unknown): CookieDetectionPatterns {
  if (!value || typeof value !== 'object') return {};
  return value as CookieDetectionPatterns;
}

function matchRegex(name: string, pattern: string) {
  try {
    return new RegExp(pattern, 'i').test(name);
  } catch {
    return false;
  }
}

function scoreForMethod(method: CookieMatchResult['matchMethod']) {
  switch (method) {
    case 'EXACT':
      return 100;
    case 'PREFIX':
      return 90;
    case 'SUFFIX':
      return 88;
    case 'REGEX':
      return 85;
    case 'SCRIPT_SOURCE':
      return 82;
    case 'NETWORK_ENDPOINT':
      return 80;
    case 'PROVIDER_DOMAIN':
      return 78;
    case 'VENDOR_SIGNATURE':
      return 75;
    default:
      return 70;
  }
}

export function matchCookieDefinition(
  definitions: CookieDefinition[],
  context: CookieMatchContext,
): CookieMatchResult | null {
  const name = context.cookieName;
  const cookieDomain = (context.cookieDomain ?? '').toLowerCase();
  const sourceUrl = (context.sourceUrl ?? '').toLowerCase();

  let best: CookieMatchResult | null = null;

  for (const definition of definitions) {
    const patterns = parsePatterns(definition.detectionPatterns);
    const candidates: Array<{ method: CookieMatchResult['matchMethod']; confidence: number }> = [];

    for (const exact of patterns.exact ?? []) {
      if (name === exact) candidates.push({ method: 'EXACT', confidence: scoreForMethod('EXACT') });
    }
    for (const prefix of patterns.prefix ?? []) {
      if (name.startsWith(prefix)) candidates.push({ method: 'PREFIX', confidence: scoreForMethod('PREFIX') });
    }
    for (const suffix of patterns.suffix ?? []) {
      if (name.endsWith(suffix)) candidates.push({ method: 'SUFFIX', confidence: scoreForMethod('SUFFIX') });
    }
    for (const regex of patterns.regex ?? []) {
      if (matchRegex(name, regex)) candidates.push({ method: 'REGEX', confidence: scoreForMethod('REGEX') });
    }
    for (const domain of patterns.providerDomains ?? []) {
      if (cookieDomain.includes(domain.toLowerCase())) {
        candidates.push({ method: 'PROVIDER_DOMAIN', confidence: scoreForMethod('PROVIDER_DOMAIN') });
      }
    }
    for (const script of patterns.scriptSources ?? []) {
      if (sourceUrl.includes(script.toLowerCase())) {
        candidates.push({ method: 'SCRIPT_SOURCE', confidence: scoreForMethod('SCRIPT_SOURCE') });
      }
    }
    for (const endpoint of patterns.networkEndpoints ?? []) {
      if (sourceUrl.includes(endpoint.toLowerCase())) {
        candidates.push({ method: 'NETWORK_ENDPOINT', confidence: scoreForMethod('NETWORK_ENDPOINT') });
      }
    }

    for (const alias of (definition.aliases as string[] | null) ?? []) {
      if (name === alias || name.startsWith(alias.replace('*', ''))) {
        candidates.push({ method: 'VENDOR_SIGNATURE', confidence: scoreForMethod('VENDOR_SIGNATURE') });
      }
    }

    if (candidates.length === 0) continue;

    const top = candidates.sort((a, b) => b.confidence - a.confidence)[0]!;
    const result: CookieMatchResult = {
      definitionId: definition.id,
      provider: definition.provider,
      providerDomain: definition.providerDomain,
      description: definition.description,
      purpose: definition.purpose,
      category: definition.category,
      duration: definition.duration,
      dataCollected: definition.dataCollected,
      isThirdParty: definition.isThirdParty,
      privacyPolicyUrl: definition.privacyPolicyUrl,
      riskLevel: definition.riskLevel,
      matchMethod: top.method,
      confidence: top.confidence,
    };

    if (!best || result.confidence > best.confidence) {
      best = result;
    }
  }

  return best;
}

export function reviewStatusForMatch(confidence: number): 'AUTO_MATCHED' | 'PENDING' {
  return confidence >= LOW_CONFIDENCE_THRESHOLD ? 'AUTO_MATCHED' : 'PENDING';
}
