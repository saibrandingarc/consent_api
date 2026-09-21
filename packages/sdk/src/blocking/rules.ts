import type { CategorySnapshot } from '../types';
import type { BlockingRule, CategoryScriptMappings } from './types';
import { KNOWN_TRACKER_PATTERNS } from './types';

export function matchPattern(value: string, pattern: string): boolean {
  const target = value.toLowerCase();
  const rule = pattern.trim().toLowerCase();
  if (!rule) return false;
  if (rule.startsWith('/') && rule.endsWith('/') && rule.length > 2) {
    try {
      return new RegExp(rule.slice(1, -1), 'i').test(value);
    } catch {
      return false;
    }
  }
  return target.includes(rule);
}

export function buildBlockingRules(categories: CategorySnapshot[]): BlockingRule[] {
  const rules: BlockingRule[] = [];
  const slugs = new Set(categories.map((category) => category.slug));

  for (const category of categories) {
    if (!category.enabled) continue;
    const mappings = (category.scriptMappings as CategoryScriptMappings | null) ?? null;
    if (!mappings) continue;

    for (const pattern of mappings.scripts ?? []) {
      rules.push({ category: category.slug, type: 'script', pattern });
    }
    for (const pattern of mappings.iframes ?? []) {
      rules.push({ category: category.slug, type: 'iframe', pattern });
    }
    for (const pattern of mappings.pixels ?? []) {
      rules.push({ category: category.slug, type: 'pixel', pattern });
    }
  }

  for (const known of KNOWN_TRACKER_PATTERNS) {
    if (!slugs.has(known.category)) continue;
    const duplicate = rules.some(
      (rule) => rule.category === known.category && rule.type === known.type && rule.pattern === known.pattern,
    );
    if (!duplicate) {
      rules.push({ category: known.category, type: known.type, pattern: known.pattern });
    }
  }

  return rules;
}

export function findRuleForUrl(rules: BlockingRule[], url: string, type: BlockingRule['type']): BlockingRule | null {
  for (const rule of rules) {
    if (rule.type !== type) continue;
    if (matchPattern(url, rule.pattern)) return rule;
  }
  return null;
}
