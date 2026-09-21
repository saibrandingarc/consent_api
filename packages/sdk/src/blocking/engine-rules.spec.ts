import { describe, expect, it } from 'vitest';
import { evaluateBlocking, buildEngineRules } from './engine-rules';
import type { CategorySnapshot } from '../types';

describe('engine rules', () => {
  const categories: CategorySnapshot[] = [
    {
      slug: 'analytics',
      name: 'Analytics',
      enabled: true,
      scriptMappings: { scripts: ['googletagmanager.com'] },
    },
  ];

  it('blocks network URLs when consent is missing', () => {
    const rules = buildEngineRules(categories);
    const decision = evaluateBlocking(rules, { strictly_necessary: true }, 'https://www.googletagmanager.com/gtag/js', 'fetch');
    expect(decision?.action).toBe('block');
    expect(decision?.rule.category).toBe('analytics');
  });

  it('allows resources when category consent is granted', () => {
    const rules = buildEngineRules(categories);
    const decision = evaluateBlocking(
      rules,
      { strictly_necessary: true, analytics: true },
      'https://www.googletagmanager.com/gtag/js',
      'fetch',
    );
    expect(decision).toBeNull();
  });

  it('skips region-scoped rules when visitor region does not match', () => {
    const rules = buildEngineRules(categories).map((rule) => ({
      ...rule,
      regions: ['EU'],
    }));
    const decision = evaluateBlocking(
      rules,
      { strictly_necessary: true },
      'https://www.googletagmanager.com/gtag/js',
      'fetch',
      'US',
    );
    expect(decision).toBeNull();
  });

  it('applies region-scoped rules when visitor region matches', () => {
    const rules = buildEngineRules(categories).map((rule) => ({
      ...rule,
      regions: ['EU'],
    }));
    const decision = evaluateBlocking(
      rules,
      { strictly_necessary: true },
      'https://www.googletagmanager.com/gtag/js',
      'fetch',
      'eu',
    );
    expect(decision?.action).toBe('block');
  });
});
