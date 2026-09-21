import { trapFocus } from './a11y';
import { isRtlLanguage } from './language';
import { sanitizeBasicHtml } from './sanitize';
import {
  buildConsentState,
  getCategoryDescription,
  getVendorDescription,
  isModalLayout,
  type BannerContent,
  type CategorySnapshot,
  type CmpConfig,
  type ConsentMetadata,
} from './types';

const STYLES = `
.cmp-banner-root{--cmp-primary:#2563eb;--cmp-bg:#fff;--cmp-text:#111827;--cmp-btn-text:#fff;--cmp-radius:8px;--cmp-font:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;--cmp-font-size:16px;--cmp-spacing:1rem;--cmp-shadow:0 10px 30px rgba(0,0,0,.15);font-family:var(--cmp-font);font-size:var(--cmp-font-size);box-sizing:border-box}
.cmp-banner-root *,.cmp-banner-root *::before,.cmp-banner-root *::after{box-sizing:inherit}
.cmp-overlay{position:fixed;inset:0;background:rgba(17,24,39,var(--cmp-overlay-opacity,.45));z-index:2147483646}
.cmp-banner{position:fixed;z-index:2147483647;background:var(--cmp-bg);color:var(--cmp-text);box-shadow:var(--cmp-shadow);max-width:100%}
.cmp-layout-bottom_bar{bottom:0;left:0;right:0;border-top:1px solid #e5e7eb}
.cmp-layout-top_bar{top:0;left:0;right:0;border-bottom:1px solid #e5e7eb}
.cmp-layout-center_modal,.cmp-layout-multi_step_modal{top:50%;left:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 2rem));border-radius:var(--cmp-radius)}
.cmp-layout-corner_popup{bottom:1rem;right:1rem;width:min(380px,calc(100vw - 2rem));border-radius:var(--cmp-radius)}
.cmp-layout-fullscreen{inset:1rem;border-radius:var(--cmp-radius)}
.cmp-layout-side_panel{top:0;right:0;bottom:0;width:min(420px,100vw);border-left:1px solid #e5e7eb}
.cmp-layout-compact{bottom:1rem;left:1rem;right:1rem;max-width:720px;margin:0 auto;border-radius:var(--cmp-radius)}
.cmp-banner-root[dir=rtl] .cmp-close{left:.75rem;right:auto}
.cmp-banner-root[dir=rtl] .cmp-layout-corner_popup{left:1rem;right:auto}
.cmp-banner-root[dir=rtl] .cmp-layout-side_panel{left:0;right:auto;border-left:0;border-right:1px solid #e5e7eb}
.cmp-inner{padding:var(--cmp-spacing)}
.cmp-logo{display:block;max-height:40px;margin-bottom:.75rem}
.cmp-step-indicator{display:flex;gap:.5rem;margin-bottom:1rem;font-size:.75rem;color:#6b7280}
.cmp-step-dot{width:.5rem;height:.5rem;border-radius:999px;background:#d1d5db}
.cmp-step-dot.is-active{background:var(--cmp-primary)}
.cmp-title{margin:0 0 .5rem;font-size:1.125rem;line-height:1.4;font-weight:600}
.cmp-description{margin:0 0 1rem;font-size:.9375rem;line-height:1.5}
.cmp-actions{display:flex;flex-wrap:wrap;gap:.5rem}
.cmp-btn{appearance:none;border:1px solid transparent;border-radius:var(--cmp-radius);padding:.625rem 1rem;font-size:.875rem;font-weight:600;cursor:pointer;line-height:1.2}
.cmp-btn:disabled{opacity:.55;cursor:not-allowed}
.cmp-btn:focus-visible{outline:2px solid var(--cmp-primary);outline-offset:2px}
.cmp-btn-primary{background:var(--cmp-primary);color:var(--cmp-btn-text)}
.cmp-btn-secondary{background:transparent;color:var(--cmp-text);border-color:#d1d5db}
.cmp-btn-soft{background:rgba(37,99,235,.1);color:var(--cmp-primary);border-color:transparent}
.cmp-links{margin-top:.75rem;font-size:.8125rem;display:flex;gap:1rem;flex-wrap:wrap}
.cmp-links a{color:var(--cmp-primary)}
.cmp-legal,.cmp-footer{margin-top:.75rem;font-size:.75rem;color:#4b5563}
.cmp-preferences{margin-top:1rem;border-top:1px solid #e5e7eb;padding-top:1rem}
.cmp-category{display:flex;gap:.75rem;align-items:flex-start;padding:.5rem 0}
.cmp-category label{flex:1;font-size:.875rem}
.cmp-category p,.cmp-vendor-note{margin:.25rem 0 0;font-size:.75rem;color:#4b5563}
.cmp-close{position:absolute;top:.75rem;right:.75rem;background:transparent;border:0;font-size:1.25rem;cursor:pointer;color:var(--cmp-text)}
.cmp-summary{margin:0 0 1rem;padding:.75rem;background:#f9fafb;border-radius:var(--cmp-radius);font-size:.875rem}
.cmp-metadata{margin:0 0 1rem;padding:.75rem;background:#f3f4f6;border-radius:var(--cmp-radius);font-size:.8125rem;color:#374151}
.cmp-metadata dt{font-weight:600;margin-top:.375rem}
.cmp-metadata dt:first-child{margin-top:0}
.cmp-metadata dd{margin:.125rem 0 0}
@media (max-width:640px){.cmp-inner{padding:.875rem}.cmp-actions{flex-direction:column}.cmp-btn{width:100%}}
@media (prefers-reduced-motion:reduce){.cmp-banner,.cmp-overlay{transition:none}}
`;

export interface BannerHandle {
  destroy: () => void;
  show: () => void;
  hide: () => void;
  openPreferences: () => void;
}

export interface RenderBannerOptions {
  /** Saved consent — used to pre-fill preference toggles when reopening. */
  initialConsent?: Record<string, boolean>;
}

function sanitizeCustomCss(css: string | undefined) {
  if (!css?.trim()) return '';
  const blocked = [/@import/i, /expression\s*\(/i, /javascript:/i];
  if (blocked.some((pattern) => pattern.test(css))) return '';
  return css.slice(0, 4000);
}

export function renderBanner(
  config: CmpConfig,
  onConsent: (categories: Record<string, boolean>) => void,
  options?: RenderBannerOptions,
): BannerHandle | null {
  const banner = config.banner;
  if (!banner || typeof document === 'undefined') return null;

  const categories = (config.categories ?? []).filter((c) => c.enabled !== false);
  const layout = banner.layout ?? 'bottom_bar';
  const theme = banner.theme ?? {};
  const isMultiStep = layout === 'multi_step_modal';
  const root = document.createElement('div');
  root.className = 'cmp-banner-root';
  root.setAttribute('data-cmp-banner', 'true');
  const activeLanguage = config.activeLanguage ?? config.defaultLanguage ?? 'en';
  const rtl = isRtlLanguage(activeLanguage);
  root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  root.setAttribute('lang', activeLanguage);

  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  const customCss = sanitizeCustomCss(theme.customCss);
  if (customCss) {
    const scoped = document.createElement('style');
    scoped.textContent = `.cmp-banner-root { ${customCss} }`;
    root.appendChild(scoped);
  }

  let overlay: HTMLDivElement | null = null;
  let releaseFocus: (() => void) | null = null;
  let view: 'banner' | 'preferences' | 'step_categories' | 'step_summary' = 'banner';
  let multiStep = 0;
  const custom: Record<string, boolean> = {};
  const reviewed = new Set<string>();

  if (isModalLayout(layout) || banner.behavior?.blockInteractionUntilChoice) {
    overlay = document.createElement('div');
    overlay.className = 'cmp-overlay';
    overlay.setAttribute('data-cmp-overlay', 'true');
    root.appendChild(overlay);
  }

  const container = document.createElement('section');
  container.className = `cmp-banner cmp-layout-${layout}`;
  container.setAttribute('role', isModalLayout(layout) ? 'dialog' : 'region');
  container.setAttribute('aria-modal', isModalLayout(layout) ? 'true' : 'false');
  container.setAttribute('aria-labelledby', 'cmp-banner-title');
  container.setAttribute('aria-describedby', 'cmp-banner-description');
  applyTheme(container, overlay, theme);
  if (isModalLayout(layout)) container.style.position = 'fixed';

  const inner = document.createElement('div');
  inner.className = 'cmp-inner';
  container.appendChild(inner);
  root.appendChild(container);

  function applyTheme(target: HTMLElement, overlayEl: HTMLDivElement | null, t: typeof theme) {
    target.style.setProperty('--cmp-primary', t.primaryColor ?? '#2563eb');
    target.style.setProperty('--cmp-bg', t.backgroundColor ?? '#ffffff');
    target.style.setProperty('--cmp-text', t.textColor ?? '#111827');
    target.style.setProperty('--cmp-btn-text', t.buttonTextColor ?? '#ffffff');
    target.style.setProperty('--cmp-radius', t.borderRadius ?? '8px');
    target.style.setProperty('--cmp-font', t.fontFamily ?? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
    target.style.setProperty('--cmp-font-size', t.fontSize ?? '16px');
    target.style.setProperty('--cmp-spacing', t.spacing ?? '1rem');
    target.style.setProperty('--cmp-shadow', t.shadow ?? '0 10px 30px rgba(0,0,0,.15)');
    if (overlayEl) {
      overlayEl.style.setProperty('--cmp-overlay-opacity', String(t.overlayOpacity ?? 0.45));
    }
  }

  function optionalCategories() {
    return categories.filter((category) => !category.required && category.slug !== 'strictly_necessary');
  }

  function allOptionalReviewed() {
    const optional = optionalCategories();
    return optional.every((category) => reviewed.has(category.slug));
  }

  function applyConsentToCustom(consent?: Record<string, boolean>) {
    const source = consent ?? options?.initialConsent;
    if (!source) return;
    categories.forEach((category) => {
      if (category.slug in source) {
        custom[category.slug] = source[category.slug];
        if (!category.required) reviewed.add(category.slug);
      }
    });
  }

  function ensureCustomDefaults() {
    categories.forEach((category) => {
      if (!(category.slug in custom)) {
        custom[category.slug] = category.defaultState === 'ENABLED';
      }
    });
  }

  applyConsentToCustom();

  function renderView() {
    inner.innerHTML = '';
    const existingClose = container.querySelector('.cmp-close');
    existingClose?.remove();

    if (banner.behavior?.allowClose) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'cmp-close';
      close.setAttribute('aria-label', banner.closeButton ?? 'Close');
      close.textContent = '×';
      close.addEventListener('click', () => hide());
      container.appendChild(close);
    }

    if (theme.logoUrl) {
      const logo = document.createElement('img');
      logo.className = 'cmp-logo';
      logo.src = theme.logoUrl;
      logo.alt = '';
      inner.appendChild(logo);
    }

    if (isMultiStep) renderMultiStep();
    else if (view === 'banner') renderMain();
    else renderPreferences();

    if (isModalLayout(layout)) {
      releaseFocus?.();
      releaseFocus = trapFocus(container, () => {
        if (view === 'preferences' || view === 'step_categories' || view === 'step_summary') {
          if (isMultiStep) {
            if (view === 'step_summary') view = 'step_categories';
            else if (view === 'step_categories') {
              view = 'banner';
              multiStep = 0;
            } else view = 'banner';
          } else {
            view = 'banner';
          }
          renderView();
        } else if (banner.behavior?.allowClose) {
          hide();
        }
      });
    }
  }

  function renderStepIndicator(activeStep: number) {
    const indicator = document.createElement('div');
    indicator.className = 'cmp-step-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    [0, 1, 2].forEach((step) => {
      const dot = document.createElement('span');
      dot.className = `cmp-step-dot${step === activeStep ? ' is-active' : ''}`;
      indicator.appendChild(dot);
    });
    inner.appendChild(indicator);
  }

  function renderMultiStep() {
    if (multiStep === 0) {
      renderStepIndicator(0);
      renderMain(true);
      return;
    }
    if (multiStep === 1) {
      view = 'step_categories';
      renderStepIndicator(1);
      renderPreferences(true);
      return;
    }
    view = 'step_summary';
    renderStepIndicator(2);
    renderSummary();
  }

  function setDescription(target: HTMLElement, content: BannerContent) {
    if (content.contentFormat === 'basic_html') {
      target.innerHTML = sanitizeBasicHtml(content.description);
    } else {
      target.textContent = content.description;
    }
  }

  function renderMain(multiStepIntro = false) {
    const title = document.createElement('h2');
    title.id = 'cmp-banner-title';
    title.className = 'cmp-title';
    title.textContent = banner.title;

    const description = document.createElement('div');
    description.id = 'cmp-banner-description';
    description.className = 'cmp-description';
    setDescription(description, banner);

    const actions = document.createElement('div');
    actions.className = 'cmp-actions';

    const accept = createButton(banner.acceptButton, 'primary', () => {
      onConsent(buildConsentState(categories, 'accept_all'));
      hide();
    });
    accept.setAttribute('data-cmp-action', 'accept-all');

    const reject = createButton(banner.rejectButton, 'secondary', () => {
      onConsent(buildConsentState(categories, 'reject_all'));
      hide();
    });
    reject.setAttribute('data-cmp-action', 'reject-all');

    const customize = createButton(
      multiStepIntro ? 'Continue' : banner.preferencesButton,
      'secondary',
      () => {
        if (multiStepIntro) {
          multiStep = 1;
          applyConsentToCustom();
          ensureCustomDefaults();
          renderView();
          return;
        }
        view = 'preferences';
        applyConsentToCustom();
        ensureCustomDefaults();
        renderView();
      },
    );
    customize.setAttribute('data-cmp-action', multiStepIntro ? 'continue' : 'customize');

    actions.append(accept, reject, customize);

    if (banner.showDoNotSell) {
      const dns = createButton(
        banner.doNotSellLabel ?? 'Do Not Sell or Share My Personal Information',
        'secondary',
        () => {
          onConsent(buildConsentState(categories, 'reject_all'));
          hide();
        },
      );
      dns.setAttribute('data-cmp-action', 'do-not-sell');
      actions.append(dns);
    }

    inner.append(title, description, actions);
    appendLinks(inner, banner);
    appendLegal(inner, banner);
  }

  function formatMetadataDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function renderConsentMetadata(metadata: ConsentMetadata) {
    const block = document.createElement('dl');
    block.className = 'cmp-metadata';
    block.setAttribute('aria-label', 'Consent information');

    const entries: Array<[string, string | null]> = [
      ['Consent date', formatMetadataDate(metadata.savedAt)],
      [
        'Policy version',
        metadata.policyVersionNumber != null
          ? String(metadata.policyVersionNumber)
          : metadata.policyVersionId,
      ],
      ['Expires', formatMetadataDate(metadata.expiresAt)],
    ];

    entries.forEach(([label, value]) => {
      if (!value) return;
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      block.append(dt, dd);
    });

    return block.childElementCount > 0 ? block : null;
  }

  function renderPreferences(multiStepMode = false) {
    const title = document.createElement('h2');
    title.id = 'cmp-banner-title';
    title.className = 'cmp-title';
    title.textContent = banner.preferencesButton;

    const metadata = config.consentMetadata;
    const metadataBlock = metadata ? renderConsentMetadata(metadata) : null;

    const prefs = document.createElement('div');
    prefs.className = 'cmp-preferences';
    prefs.setAttribute('role', 'group');
    prefs.setAttribute('aria-label', 'Cookie categories');

    categories.forEach((category) => {
      if (category.required) {
        custom[category.slug] = true;
        return;
      }
      prefs.appendChild(renderCategoryToggle(category, custom, reviewed));
    });

    const actions = document.createElement('div');
    actions.className = 'cmp-actions';

    const save = createButton(
      multiStepMode ? 'Review choices' : (banner.saveButton ?? 'Save preferences'),
      'primary',
      () => {
        if (multiStepMode) {
          multiStep = 2;
          renderView();
          return;
        }
        onConsent(buildConsentState(categories, 'custom', custom));
        hide();
      },
    );
    save.disabled = !allOptionalReviewed();
    save.setAttribute('data-cmp-action', multiStepMode ? 'review-choices' : 'save-preferences');
    save.setAttribute('aria-disabled', String(save.disabled));

    const back = createButton('Back', 'secondary', () => {
      if (multiStepMode) {
        multiStep = 0;
        renderView();
        return;
      }
      view = 'banner';
      renderView();
    });
    back.setAttribute('data-cmp-action', 'back');

    actions.append(save, back);
    if (metadataBlock) {
      inner.append(title, metadataBlock, prefs, actions);
    } else {
      inner.append(title, prefs, actions);
    }
    appendLegal(inner, banner);
  }

  function renderSummary() {
    const title = document.createElement('h2');
    title.id = 'cmp-banner-title';
    title.className = 'cmp-title';
    title.textContent = 'Review your choices';

    const summary = document.createElement('div');
    summary.id = 'cmp-banner-description';
    summary.className = 'cmp-summary';
    summary.setAttribute('role', 'status');
    summary.innerHTML = categories
      .filter((category) => category.enabled !== false)
      .map((category) => {
        const enabled = custom[category.slug] ?? category.defaultState === 'ENABLED';
        return `<div><strong>${category.name}</strong>: ${enabled ? 'Allowed' : 'Blocked'}</div>`;
      })
      .join('');

    const actions = document.createElement('div');
    actions.className = 'cmp-actions';
    const save = createButton(banner.saveButton ?? 'Save preferences', 'primary', () => {
      onConsent(buildConsentState(categories, 'custom', custom));
      hide();
    });
    save.setAttribute('data-cmp-action', 'save-preferences');
    const back = createButton('Back', 'secondary', () => {
      multiStep = 1;
      renderView();
    });
    back.setAttribute('data-cmp-action', 'back');
    actions.append(save, back);
    inner.append(title, summary, actions);
  }

  function renderCategoryToggle(
    category: CategorySnapshot,
    state: Record<string, boolean>,
    reviewedSet: Set<string>,
  ) {
    const row = document.createElement('div');
    row.className = 'cmp-category';
    const id = `cmp-cat-${category.slug}`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = state[category.slug] ?? false;
    input.disabled = Boolean(category.required);
    input.setAttribute('aria-describedby', `${id}-desc`);
    input.addEventListener('change', () => {
      state[category.slug] = input.checked;
      reviewedSet.add(category.slug);
      const saveBtn = container.querySelector('[data-cmp-action="save-preferences"], [data-cmp-action="review-choices"]') as HTMLButtonElement | null;
      if (saveBtn) {
        saveBtn.disabled = !allOptionalReviewed();
        saveBtn.setAttribute('aria-disabled', String(saveBtn.disabled));
      }
    });
    const label = document.createElement('label');
    label.htmlFor = id;
    label.innerHTML = `<strong>${category.name}</strong>`;
    const descText = getCategoryDescription(banner, category);
    if (descText) {
      const desc = document.createElement('p');
      desc.id = `${id}-desc`;
      desc.textContent = descText;
      label.appendChild(desc);
    }
    const vendors = category.vendorPurposes ?? [];
    vendors.forEach((vendorKey) => {
      const vendorText = getVendorDescription(banner, vendorKey);
      if (vendorText) {
        const note = document.createElement('p');
        note.className = 'cmp-vendor-note';
        note.textContent = vendorText;
        label.appendChild(note);
      }
    });
    row.append(input, label);
    return row;
  }

  function createButton(label: string, variant: 'primary' | 'secondary' | 'soft', onClick: () => void) {
    const buttonStyle = theme.buttonStyle ?? 'filled';
    const resolvedVariant =
      variant === 'primary'
        ? buttonStyle === 'outline'
          ? 'secondary'
          : buttonStyle === 'soft'
            ? 'soft'
            : 'primary'
        : variant;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cmp-btn cmp-btn-${resolvedVariant}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function appendLinks(parent: HTMLElement, content: BannerContent) {
    if (!content.privacyPolicyUrl && !content.cookiePolicyUrl) return;
    const links = document.createElement('div');
    links.className = 'cmp-links';
    if (content.privacyPolicyUrl) {
      const a = document.createElement('a');
      a.href = content.privacyPolicyUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Privacy policy';
      links.appendChild(a);
    }
    if (content.cookiePolicyUrl) {
      const a = document.createElement('a');
      a.href = content.cookiePolicyUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Cookie policy';
      links.appendChild(a);
    }
    parent.appendChild(links);
  }

  function appendLegal(parent: HTMLElement, content: BannerContent) {
    if (content.legalNotice) {
      const legal = document.createElement('p');
      legal.className = 'cmp-legal';
      legal.textContent = content.legalNotice;
      parent.appendChild(legal);
    }
    if (content.footerContent) {
      const footer = document.createElement('p');
      footer.className = 'cmp-footer';
      footer.textContent = content.footerContent;
      parent.appendChild(footer);
    }
  }

  function show() {
    if (!document.body.contains(root)) document.body.appendChild(root);
    view = 'banner';
    multiStep = 0;
    renderView();
  }

  function hide() {
    releaseFocus?.();
    releaseFocus = null;
    root.remove();
  }

  function destroy() {
    hide();
  }

  function openPreferences() {
    view = 'preferences';
    multiStep = 0;
    applyConsentToCustom();
    ensureCustomDefaults();
    if (!document.body.contains(root)) document.body.appendChild(root);
    renderView();
  }

  return { destroy, show, hide, openPreferences };
}
