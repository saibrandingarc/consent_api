export interface VendorPatternPayload {
  vendor: string;
  category: string;
  patterns: string[];
  resourceTypes: string[];
}

export function buildVendorPatterns(
  definitions: Array<{
    provider: string;
    category: string;
    detectionPatterns: unknown;
  }>,
): VendorPatternPayload[] {
  return definitions.map((definition) => {
    const patterns = definition.detectionPatterns as {
      exact?: string[];
      prefix?: string[];
      suffix?: string[];
      regex?: string[];
      providerDomains?: string[];
      scriptSources?: string[];
      networkEndpoints?: string[];
    };

    const merged = [
      ...(patterns.exact ?? []),
      ...(patterns.prefix ?? []),
      ...(patterns.suffix ?? []),
      ...(patterns.regex ?? []),
      ...(patterns.providerDomains ?? []),
      ...(patterns.scriptSources ?? []),
      ...(patterns.networkEndpoints ?? []),
    ].filter(Boolean);

    return {
      vendor: definition.provider,
      category: definition.category,
      patterns: merged,
      resourceTypes: ['script', 'fetch', 'xhr', 'beacon', 'pixel', 'iframe'],
    };
  });
}
