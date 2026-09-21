export interface CookieDeclarationEntry {
  cookieName: string;
  cookieDomain?: string | null;
  provider?: string | null;
  purpose?: string | null;
  category?: string | null;
  duration?: string | null;
  isThirdParty?: boolean | null;
  privacyPolicyUrl?: string | null;
  description?: string | null;
}

export interface CookieDeclarationOptions {
  domainKey: string;
  apiBase: string;
  language?: string;
  onClose?: () => void;
}

export interface CookieDeclarationHandle {
  destroy: () => void;
  refresh: () => Promise<void>;
}

const STYLES = `
.cmp-cookie-decl{--cmp-primary:#2563eb;--cmp-bg:#fff;--cmp-text:#111827;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:var(--cmp-text);box-sizing:border-box}
.cmp-cookie-decl *,.cmp-cookie-decl *::before,.cmp-cookie-decl *::after{box-sizing:inherit}
.cmp-cookie-decl-modal{position:fixed;inset:0;z-index:2147483646;background:rgba(17,24,39,.45);display:flex;align-items:center;justify-content:center;padding:1rem}
.cmp-cookie-decl-panel{background:var(--cmp-bg);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.15);width:min(960px,100%);max-height:min(85vh,720px);display:flex;flex-direction:column;overflow:hidden}
.cmp-cookie-decl-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb}
.cmp-cookie-decl-title{margin:0;font-size:1.125rem;font-weight:600}
.cmp-cookie-decl-close{background:transparent;border:0;font-size:1.25rem;cursor:pointer;color:var(--cmp-text);line-height:1}
.cmp-cookie-decl-toolbar{display:flex;flex-wrap:wrap;gap:.75rem;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb}
.cmp-cookie-decl-search{flex:1;min-width:180px;padding:.5rem .75rem;border:1px solid #d1d5db;border-radius:6px;font:inherit}
.cmp-cookie-decl-filter{padding:.5rem .75rem;border:1px solid #d1d5db;border-radius:6px;font:inherit;background:var(--cmp-bg)}
.cmp-cookie-decl-body{overflow:auto;padding:0 1.25rem 1.25rem}
.cmp-cookie-decl-table{width:100%;border-collapse:collapse;font-size:.8125rem}
.cmp-cookie-decl-table th,.cmp-cookie-decl-table td{padding:.625rem .5rem;text-align:left;border-bottom:1px solid #e5e7eb;vertical-align:top}
.cmp-cookie-decl-table th{font-weight:600;color:#374151;position:sticky;top:0;background:var(--cmp-bg)}
.cmp-cookie-decl-empty{padding:2rem 0;text-align:center;color:#6b7280}
.cmp-cookie-decl-error{padding:1rem 1.25rem;color:#b91c1c;background:#fef2f2;border-radius:6px;margin:1rem 1.25rem}
.cmp-cookie-decl-loading{padding:2rem;text-align:center;color:#6b7280}
.cmp-cookie-decl a{color:var(--cmp-primary)}
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function partyLabel(isThirdParty: boolean | null | undefined) {
  if (isThirdParty === true) return 'Third-party';
  if (isThirdParty === false) return 'First-party';
  return '—';
}

export function mountCookieDeclaration(
  container: HTMLElement,
  options: CookieDeclarationOptions,
): CookieDeclarationHandle {
  const isModal = container.hasAttribute('data-cmp-cookie-declaration-modal');
  let destroyed = false;
  let cookies: CookieDeclarationEntry[] = [];
  let searchQuery = '';
  let categoryFilter = '';

  const root = document.createElement('div');
  root.className = isModal ? 'cmp-cookie-decl cmp-cookie-decl-modal' : 'cmp-cookie-decl';
  root.setAttribute('data-cmp-cookie-declaration', 'true');

  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  const panel = document.createElement('div');
  panel.className = isModal ? 'cmp-cookie-decl-panel' : 'cmp-cookie-decl-embed';
  root.appendChild(panel);

  const header = document.createElement('div');
  header.className = 'cmp-cookie-decl-header';
  const title = document.createElement('h2');
  title.className = 'cmp-cookie-decl-title';
  title.textContent = 'Cookie declaration';
  header.appendChild(title);

  if (isModal || options.onClose) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cmp-cookie-decl-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => options.onClose?.());
    header.appendChild(close);
  }
  panel.appendChild(header);

  const toolbar = document.createElement('div');
  toolbar.className = 'cmp-cookie-decl-toolbar';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'cmp-cookie-decl-search';
  search.placeholder = 'Search cookies…';
  search.setAttribute('aria-label', 'Search cookies');
  search.addEventListener('input', () => {
    searchQuery = search.value.trim().toLowerCase();
    renderTable();
  });

  const filter = document.createElement('select');
  filter.className = 'cmp-cookie-decl-filter';
  filter.setAttribute('aria-label', 'Filter by category');
  filter.addEventListener('change', () => {
    categoryFilter = filter.value;
    renderTable();
  });

  toolbar.append(search, filter);
  panel.appendChild(toolbar);

  const body = document.createElement('div');
  body.className = 'cmp-cookie-decl-body';
  panel.appendChild(body);

  container.innerHTML = '';
  container.appendChild(root);

  function uniqueCategories(items: CookieDeclarationEntry[]) {
    const categories = new Set<string>();
    items.forEach((item) => {
      if (item.category?.trim()) categories.add(item.category.trim());
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }

  function updateCategoryFilter(items: CookieDeclarationEntry[]) {
    const current = categoryFilter;
    filter.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All categories';
    filter.appendChild(all);
    uniqueCategories(items).forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filter.appendChild(option);
    });
    filter.value = current;
    if (current && !uniqueCategories(items).includes(current)) {
      categoryFilter = '';
      filter.value = '';
    }
  }

  function filteredCookies() {
    return cookies.filter((cookie) => {
      if (categoryFilter && cookie.category !== categoryFilter) return false;
      if (!searchQuery) return true;
      const haystack = [
        cookie.cookieName,
        cookie.provider,
        cookie.purpose,
        cookie.category,
        cookie.description,
        cookie.cookieDomain,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  function renderTable() {
    const rows = filteredCookies();
    if (rows.length === 0) {
      body.innerHTML = `<div class="cmp-cookie-decl-empty">No cookies match your filters.</div>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'cmp-cookie-decl-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Provider</th>
          <th scope="col">Purpose</th>
          <th scope="col">Category</th>
          <th scope="col">Expiration</th>
          <th scope="col">Type</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    rows.forEach((cookie) => {
      const row = document.createElement('tr');
      const policyCell = cookie.privacyPolicyUrl
        ? `<a href="${escapeHtml(cookie.privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Policy</a>`
        : '';
      row.innerHTML = `
        <td>${escapeHtml(cookie.cookieName)}</td>
        <td>${escapeHtml(cookie.provider ?? '—')}${policyCell ? `<br>${policyCell}` : ''}</td>
        <td>${escapeHtml(cookie.purpose ?? cookie.description ?? '—')}</td>
        <td>${escapeHtml(cookie.category ?? '—')}</td>
        <td>${escapeHtml(cookie.duration ?? '—')}</td>
        <td>${escapeHtml(partyLabel(cookie.isThirdParty))}</td>
      `;
      tbody.appendChild(row);
    });

    body.innerHTML = '';
    body.appendChild(table);
  }

  function showLoading() {
    body.innerHTML = '<div class="cmp-cookie-decl-loading">Loading cookie declaration…</div>';
  }

  function showError(message: string) {
    body.innerHTML = `<div class="cmp-cookie-decl-error" role="alert">${escapeHtml(message)}</div>`;
  }

  async function load() {
    if (destroyed) return;
    showLoading();
    try {
      const params = new URLSearchParams();
      if (options.language) params.set('language', options.language);
      const query = params.toString();
      const url = `${options.apiBase}/cookie-declaration/${encodeURIComponent(options.domainKey)}${query ? `?${query}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();
      if (destroyed) return;
      if (!result.ok || !result.data) {
        showError(result.error?.message ?? 'Unable to load cookie declaration.');
        return;
      }
      const payload = result.data as { cookies?: CookieDeclarationEntry[] };
      cookies = payload.cookies ?? [];
      updateCategoryFilter(cookies);
      renderTable();
    } catch {
      if (!destroyed) showError('Unable to load cookie declaration.');
    }
  }

  void load();

  return {
    destroy: () => {
      destroyed = true;
      root.remove();
    },
    refresh: load,
  };
}
