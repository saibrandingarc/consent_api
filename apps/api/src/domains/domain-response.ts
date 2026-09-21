import type { SdkHeartbeatPayload } from './installation-checks';

export interface DomainResponse {
  id: string;
  organizationId: string;
  hostname: string;
  domainKey: string;
  domainType: string;
  isProduction: boolean;
  enabled: boolean;
  groupName: string | null;
  scanLimit: number;
  scanFrequency: string;
  nextScanAt: Date | null;
  environment: string;
  region: string | null;
  autoBlocking: boolean;
  debugMode: boolean;
  configVersion: number;
  verificationStatus: string;
  verificationMethod: string | null;
  verificationToken: string;
  verifiedAt: Date | null;
  lastVerifiedAt: Date | null;
  sdkLastSeenAt: Date | null;
  sdkLastHeartbeat: SdkHeartbeatPayload | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDomainResponse(domain: {
  id: string;
  organizationId: string;
  hostname: string;
  domainKey: string;
  domainType: string;
  isProduction: boolean;
  enabled: boolean;
  groupName: string | null;
  scanLimit: number;
  scanFrequency: string;
  nextScanAt: Date | null;
  environment: string;
  region: string | null;
  autoBlocking: boolean;
  debugMode: boolean;
  configVersion: number;
  verificationStatus: string;
  verificationMethod: string | null;
  verificationToken: string;
  verifiedAt: Date | null;
  lastVerifiedAt: Date | null;
  sdkLastSeenAt: Date | null;
  sdkLastHeartbeat: unknown;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DomainResponse {
  return {
    ...domain,
    sdkLastHeartbeat: (domain.sdkLastHeartbeat as SdkHeartbeatPayload | null) ?? null,
  };
}
