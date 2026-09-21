import { describe, expect, it } from 'vitest';
import { deriveSharedCookieDomain } from './cookie-domain';

describe('deriveSharedCookieDomain', () => {
  it('returns parent domain for subdomains', () => {
    expect(deriveSharedCookieDomain('www.example.com')).toBe('.example.com');
  });

  it('returns null for localhost', () => {
    expect(deriveSharedCookieDomain('localhost')).toBeNull();
  });
});
