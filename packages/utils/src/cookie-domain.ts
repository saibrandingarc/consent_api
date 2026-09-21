export function deriveSharedCookieDomain(hostname: string): string | null {
  if (!hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  return `.${parts.slice(-2).join('.')}`;
}
