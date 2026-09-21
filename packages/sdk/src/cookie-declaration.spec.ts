import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountCookieDeclaration } from './cookie-declaration';

describe('mountCookieDeclaration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders searchable cookie table from API response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          cookies: [
            {
              cookieName: '_ga',
              provider: 'Google',
              purpose: 'Analytics',
              category: 'analytics',
              duration: '2 years',
              isThirdParty: false,
            },
            {
              cookieName: '_fbp',
              provider: 'Meta',
              purpose: 'Advertising',
              category: 'marketing',
              duration: '3 months',
              isThirdParty: true,
            },
          ],
        },
      }),
    } as Response);

    const container = document.createElement('div');
    document.body.appendChild(container);

    mountCookieDeclaration(container, {
      domainKey: 'dk_test',
      apiBase: 'https://api.example.com/public/cmp',
    });

    await vi.waitFor(() => {
      expect(document.querySelector('.cmp-cookie-decl-table tbody tr')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/public/cmp/cookie-declaration/dk_test',
    );
    expect(document.querySelectorAll('.cmp-cookie-decl-table tbody tr')).toHaveLength(2);

    const search = document.querySelector('.cmp-cookie-decl-search') as HTMLInputElement;
    search.value = '_ga';
    search.dispatchEvent(new Event('input'));

    expect(document.querySelectorAll('.cmp-cookie-decl-table tbody tr')).toHaveLength(1);
    expect(document.querySelector('.cmp-cookie-decl-table tbody tr')?.textContent).toContain('_ga');

    const filter = document.querySelector('.cmp-cookie-decl-filter') as HTMLSelectElement;
    search.value = '';
    search.dispatchEvent(new Event('input'));
    filter.value = 'marketing';
    filter.dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('.cmp-cookie-decl-table tbody tr')).toHaveLength(1);
    expect(document.querySelector('.cmp-cookie-decl-table tbody tr')?.textContent).toContain('_fbp');
  });
});
