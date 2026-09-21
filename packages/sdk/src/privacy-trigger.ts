import type { PrivacyTriggerConfig } from './types';

const TRIGGER_STYLE = `
.cmp-privacy-trigger{position:fixed;z-index:2147483645;border:0;border-radius:999px;padding:.75rem 1rem;font-size:.8125rem;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.15);background:#111827;color:#fff}
.cmp-privacy-trigger:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.cmp-privacy-trigger-bottom-right{bottom:1rem;right:1rem}
.cmp-privacy-trigger-bottom-left{bottom:1rem;left:1rem}
.cmp-privacy-footer-link{color:inherit;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit}
.cmp-dns-link{color:inherit;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit;margin-left:.75rem}
.cmp-dns-floating{position:fixed;z-index:2147483645;bottom:4.5rem;right:1rem;border:0;border-radius:999px;padding:.625rem .875rem;font-size:.75rem;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12);background:#fff;color:#111827;border:1px solid #d1d5db}
`;

export interface PrivacyTriggerHandle {
  destroy: () => void;
}

export interface DoNotSellOptions {
  label: string;
  onDoNotSell: () => void;
}

export function mountPrivacyTrigger(
  config: PrivacyTriggerConfig | undefined,
  onOpen: () => void,
  doNotSell?: DoNotSellOptions,
): PrivacyTriggerHandle | null {
  if (typeof document === 'undefined') return null;

  const style = document.createElement('style');
  style.textContent = TRIGGER_STYLE;
  document.head.appendChild(style);

  let footerLink: HTMLButtonElement | null = null;
  let floatingButton: HTMLButtonElement | null = null;
  let dnsButton: HTMLButtonElement | null = null;
  let unbindCustom: (() => void) | null = null;

  const shouldMountPreferences =
    Boolean(config?.enabled) && config?.mode !== 'api_only';

  if (shouldMountPreferences) {
    if (config?.mode === 'footer_link' && config.footerSelector) {
      const target = document.querySelector(config.footerSelector);
      if (target) {
        footerLink = document.createElement('button');
        footerLink.type = 'button';
        footerLink.className = 'cmp-privacy-footer-link';
        footerLink.textContent = config.label ?? 'Privacy settings';
        footerLink.setAttribute('data-cmp-privacy-trigger', 'true');
        footerLink.addEventListener('click', onOpen);
        target.appendChild(footerLink);
      }
    }

    if (config?.mode === 'floating_icon' || (config?.mode === 'footer_link' && !footerLink)) {
      floatingButton = document.createElement('button');
      floatingButton.type = 'button';
      floatingButton.className = `cmp-privacy-trigger cmp-privacy-trigger-${config?.position ?? 'bottom-right'}`;
      floatingButton.setAttribute('aria-label', config?.label ?? 'Privacy settings');
      floatingButton.setAttribute('data-cmp-privacy-trigger', 'true');
      floatingButton.textContent = config?.label ?? 'Privacy settings';
      floatingButton.addEventListener('click', onOpen);
      document.body.appendChild(floatingButton);
    }
  }

  if (doNotSell) {
    const footerTarget =
      (config?.footerSelector ? document.querySelector(config.footerSelector) : null) ??
      document.querySelector('footer') ??
      null;

    dnsButton = document.createElement('button');
    dnsButton.type = 'button';
    dnsButton.textContent = doNotSell.label;
    dnsButton.setAttribute('data-cmp-do-not-sell', 'true');
    dnsButton.setAttribute('aria-label', doNotSell.label);
    dnsButton.addEventListener('click', (event) => {
      event.preventDefault();
      doNotSell.onDoNotSell();
    });

    if (footerTarget) {
      dnsButton.className = 'cmp-dns-link';
      footerTarget.appendChild(dnsButton);
    } else {
      dnsButton.className = 'cmp-dns-floating';
      document.body.appendChild(dnsButton);
    }
  }

  unbindCustom = bindCustomTriggers(onOpen, doNotSell?.onDoNotSell);

  if (!shouldMountPreferences && !doNotSell) {
    style.remove();
    unbindCustom();
    return null;
  }

  return {
    destroy: () => {
      style.remove();
      footerLink?.remove();
      floatingButton?.remove();
      dnsButton?.remove();
      unbindCustom?.();
    },
  };
}

function bindCustomTriggers(onOpen: () => void, onDoNotSell?: () => void) {
  const preferenceElements = Array.from(document.querySelectorAll('[data-cmp-open]'));
  const dnsElements = Array.from(document.querySelectorAll('[data-cmp-do-not-sell-link]'));

  const openHandler = (event: Event) => {
    event.preventDefault();
    onOpen();
  };
  const dnsHandler = (event: Event) => {
    event.preventDefault();
    onDoNotSell?.();
  };

  preferenceElements.forEach((element) => element.addEventListener('click', openHandler));
  dnsElements.forEach((element) => element.addEventListener('click', dnsHandler));

  return () => {
    preferenceElements.forEach((element) => element.removeEventListener('click', openHandler));
    dnsElements.forEach((element) => element.removeEventListener('click', dnsHandler));
  };
}
