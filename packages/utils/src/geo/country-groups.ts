/** EU member states (ISO 3166-1 alpha-2). */
export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

export const COUNTRY_GROUP_MEMBERS: Record<string, Set<string>> = {
  EU: EU_COUNTRIES,
  UK: new Set(['GB', 'UK']),
  US: new Set(['US']),
  // California is matched via countries: ['US'] + regions: ['CA'], not a country group.
  BR: new Set(['BR']),
  CA: new Set(['CA']),
  AU: new Set(['AU']),
  IN: new Set(['IN']),
  ZA: new Set(['ZA']),
};

export function countryMatchesGroup(country: string | null | undefined, group: string): boolean {
  if (!country) return false;
  const normalized = country.toUpperCase();
  const members = COUNTRY_GROUP_MEMBERS[group.toUpperCase()];
  if (!members) return normalized === group.toUpperCase();
  return members.has(normalized);
}

export function countryInGroups(country: string | null | undefined, groups: string[] | undefined): boolean {
  if (!groups?.length || !country) return false;
  return groups.some((group) => countryMatchesGroup(country, group));
}
