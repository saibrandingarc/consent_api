export async function buildConsentChecksum(input: {
  visitorId: string;
  configVersion: number;
  categories: Record<string, boolean>;
  savedAt: string;
}): Promise<string> {
  const payload = JSON.stringify({
    visitorId: input.visitorId,
    configVersion: input.configVersion,
    categories: input.categories,
    savedAt: input.savedAt,
  });

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }

  return fallbackHash(payload).slice(0, 32);
}

function fallbackHash(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
