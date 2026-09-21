import { Injectable } from '@nestjs/common';
import {
  applyRegulationProfile,
  detectCountryFromHeaders,
  mergeDetectedGeo,
  resolveGeoRegulation,
  type DetectedGeo,
  type GeoRegulationSettings,
} from '@cmp/utils';

export interface GeoResolutionInput {
  headers: Record<string, string | string[] | undefined>;
  domainRegion?: string | null;
  geoTargetingDisabled?: boolean;
  previewCountry?: string | null;
  previewRegion?: string | null;
  ipGeo?: { country: string | null; region?: string | null } | null;
  clientHints?: {
    country?: string | null;
    region?: string | null;
    language?: string;
    timezone?: string | null;
  };
  regulationConfig?: Record<string, unknown> | null;
  orgDefaultRegulation?: string | null;
  banner?: Record<string, unknown> | null;
  categories?: Array<{ slug: string; defaultState?: string; enabled?: boolean }> | null;
}

export interface GeoResolutionResult {
  visitorGeo: DetectedGeo;
  applicableRegulation: string;
  regulationProfileId: string;
  matchedRuleId: string | null;
  banner: Record<string, unknown> | null;
  categories: Array<{ slug: string; defaultState?: string; enabled?: boolean }> | null;
  region: string | null;
}

@Injectable()
export class GeoRegulationService {
  resolve(input: GeoResolutionInput): GeoResolutionResult {
    const regulationConfig = (input.regulationConfig ?? {}) as {
      geo?: GeoRegulationSettings;
    };
    const geoSettings = regulationConfig.geo;

    const serverGeo = input.geoTargetingDisabled
      ? { country: null, region: null, source: 'disabled' as const }
      : input.ipGeo?.country
        ? { country: input.ipGeo.country, region: input.ipGeo.region ?? null, source: 'ip_api' as const }
        : detectCountryFromHeaders(input.headers);

    const client = {
      country: input.clientHints?.country ?? input.ipGeo?.country ?? null,
      region: input.clientHints?.region ?? input.ipGeo?.region ?? serverGeo.region ?? null,
      language: input.clientHints?.language ?? 'en',
      timezone: input.clientHints?.timezone ?? null,
    };

    const visitorGeo = mergeDetectedGeo(
      serverGeo,
      client,
      input.domainRegion,
      input.geoTargetingDisabled,
      input.previewCountry,
      input.previewRegion,
    );

    const resolved = resolveGeoRegulation(
      {
        country: visitorGeo.country,
        region: visitorGeo.region,
        language: visitorGeo.language,
        regulation: input.orgDefaultRegulation,
      },
      geoSettings,
    );

    const applied = applyRegulationProfile(
      input.banner,
      input.categories,
      resolved.profile,
      resolved.matchedRule,
    );

    return {
      visitorGeo,
      applicableRegulation: resolved.regulation,
      regulationProfileId: resolved.profileId,
      matchedRuleId: resolved.matchedRule?.id ?? null,
      banner: applied.banner,
      categories: applied.categories,
      region: visitorGeo.region,
    };
  }
}
