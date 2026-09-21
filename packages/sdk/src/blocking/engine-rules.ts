import type { CategorySnapshot, CmpConfig } from '../types';
import type { BlockingRule, CategoryScriptMappings, VendorPattern } from './types';
import { KNOWN_TRACKER_PATTERNS } from './types';
import { buildBlockingRules, findRuleForUrl, matchPattern } from './rules';

const NETWORK_TYPES: BlockingRule['type'][] = ['fetch', 'xhr', 'beacon', 'image'];

export interface BlockingDecision {
  rule: BlockingRule;
  action: 'block' | 'allow' | 'log';
}

export function buildEngineRules(categories: CategorySnapshot[], vendorPatterns?: VendorPattern[]): BlockingRule[] {
  const rules = buildBlockingRules(categories);

  for (const vendor of vendorPatterns ?? []) {
    const types = vendor.resourceTypes ?? ['script', 'fetch', 'xhr', 'beacon', 'pixel'];
    for (const pattern of vendor.patterns) {
      for (const type of types) {
        const duplicate = rules.some(
          (rule) =>
            rule.category === vendor.category &&
            rule.type === type &&
            rule.pattern === pattern &&
            rule.vendor === vendor.vendor,
        );
        if (!duplicate) {
          rules.push({
            category: vendor.category,
            type,
            pattern,
            vendor: vendor.vendor,
            action: 'block',
          });
        }
      }
    }
  }

  return rules;
}

export function findEngineRule(
  rules: BlockingRule[],
  url: string,
  type: BlockingRule['type'],
): BlockingRule | null {
  const direct = findRuleForUrl(rules, url, type);
  if (direct) return direct;

  if (NETWORK_TYPES.includes(type)) {
    for (const rule of rules) {
      const applies =
        rule.type === 'script' ||
        rule.type === 'iframe' ||
        rule.type === 'pixel' ||
        NETWORK_TYPES.includes(rule.type);
      if (!applies) continue;
      if (matchPattern(url, rule.pattern)) return { ...rule, type };
    }
  }

  return null;
}

export function evaluateBlocking(
  rules: BlockingRule[],
  consent: Record<string, boolean>,
  url: string,
  type: BlockingRule['type'],
  visitorRegion?: string | null,
): BlockingDecision | null {
  const rule = findEngineRule(rules, url, type);
  if (!rule) return null;
  if (rule.regions?.length && visitorRegion) {
    const normalized = visitorRegion.toUpperCase();
    const matches = rule.regions.some((r) => r.toUpperCase() === normalized);
    if (!matches) return null;
  }
  if (rule.action === 'allow') return null;
  if (rule.category === 'strictly_necessary') return null;
  if (consent[rule.category]) return null;

  return {
    rule,
    action: rule.action === 'log' ? 'log' : 'block',
  };
}

export function rulesFromConfig(config: CmpConfig): BlockingRule[] {
  return buildEngineRules(config.categories ?? [], config.vendorPatterns as VendorPattern[] | undefined);
}
