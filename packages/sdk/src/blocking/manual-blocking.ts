import type { CategorySnapshot, CmpConfig } from '../types';
import type { BannerContent } from '../types';
import { buildBlockingRules, findRuleForUrl } from './rules';
import { createEmbedPlaceholder, isCmpManagedElement } from './placeholder';
import type { BlockingRule, EmbedPlaceholderConfig } from './types';

const BLOCKED_ATTR = 'data-cmp-blocked';
const EXECUTED_ATTR = 'data-cmp-executed';

export class ManualBlockingController {
  private readonly rules: BlockingRule[];
  private readonly placeholders: Record<string, EmbedPlaceholderConfig>;
  private readonly categoryNames: Record<string, string>;
  private readonly getConsent: () => Record<string, boolean>;
  private readonly onOpenPreferences: () => void;
  private readonly blockedIframes = new Map<HTMLIFrameElement, HTMLElement>();
  private readonly blockedImages = new Map<HTMLImageElement, string>();
  private readonly activatedScriptIds = new Set<string>();

  constructor(
    config: CmpConfig,
    getConsent: () => Record<string, boolean>,
    onOpenPreferences: () => void,
  ) {
    this.rules = buildBlockingRules(config.categories ?? []);
    this.placeholders = (config.banner as BannerContent | undefined)?.embedPlaceholders ?? {};
    this.categoryNames = Object.fromEntries(
      (config.categories ?? []).map((category) => [category.slug, category.name]),
    );
    this.getConsent = getConsent;
    this.onOpenPreferences = onOpenPreferences;
  }

  scanDOM() {
    if (typeof document === 'undefined') return;
    this.processScripts();
    this.processIframes();
    this.processPixels();
  }

  sync(consent: Record<string, boolean>) {
    this.processScripts(consent);
    this.processIframes(consent);
    this.processPixels(consent);
  }

  destroy() {
    for (const [iframe, placeholder] of this.blockedIframes.entries()) {
      placeholder.replaceWith(iframe);
      iframe.style.display = '';
    }
    this.blockedIframes.clear();

    for (const [img, src] of this.blockedImages.entries()) {
      img.src = src;
    }
    this.blockedImages.clear();
  }

  private hasConsent(category: string, consent?: Record<string, boolean>) {
    const state = consent ?? this.getConsent();
    if (category === 'strictly_necessary') return true;
    return Boolean(state[category]);
  }

  private resolveCategoryFromElement(element: Element, url: string, type: BlockingRule['type']): string | null {
    const explicit = element.getAttribute('data-cmp-category');
    if (explicit) return explicit;
    const vendor = element.getAttribute('data-cmp-vendor');
    if (vendor) return vendor;
    const rule = findRuleForUrl(this.rules, url, type);
    return rule?.category ?? null;
  }

  private processScripts(consent?: Record<string, boolean>) {
    const scripts = document.querySelectorAll<HTMLScriptElement>('script');
    for (const script of scripts) {
      if (isCmpManagedElement(script)) continue;
      if (script.type === 'application/json' || script.id?.startsWith('cmp-')) continue;

      const src = script.getAttribute('src') ?? script.getAttribute('data-cmp-src') ?? '';
      const category = this.resolveCategoryFromElement(script, src, 'script');
      if (!category || category === 'strictly_necessary') continue;

      if (this.hasConsent(category, consent)) {
        this.activateScript(script);
      } else {
        this.blockScript(script);
      }
    }
  }

  private blockScript(script: HTMLScriptElement) {
    if (script.getAttribute(BLOCKED_ATTR) === 'true') return;

    script.setAttribute(BLOCKED_ATTR, 'true');
    if (script.src) {
      script.setAttribute('data-cmp-src', script.src);
      script.removeAttribute('src');
    }
    if (script.textContent?.trim()) {
      script.setAttribute('data-cmp-inline', script.textContent);
      script.textContent = '';
    }
    script.type = 'text/plain';
  }

  private activateScript(script: HTMLScriptElement) {
    if (script.getAttribute(EXECUTED_ATTR) === 'true') return;

    const src = script.getAttribute('data-cmp-src') ?? script.src;
    const inline = script.getAttribute('data-cmp-inline');
    const id = script.id || `cmp-activated-${Math.random().toString(36).slice(2)}`;

    if (this.activatedScriptIds.has(id)) return;

    const executable = document.createElement('script');
    if (src) {
      executable.src = src;
      executable.async = script.async;
      executable.defer = script.defer;
    } else if (inline) {
      executable.textContent = inline;
    } else {
      return;
    }

    if (script.id) executable.id = script.id;
    document.head.appendChild(executable);
    this.activatedScriptIds.add(id);
    script.setAttribute(EXECUTED_ATTR, 'true');
    script.removeAttribute(BLOCKED_ATTR);
  }

  private processIframes(consent?: Record<string, boolean>) {
    const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
    for (const iframe of iframes) {
      if (isCmpManagedElement(iframe)) continue;

      const src = iframe.getAttribute('src') ?? iframe.getAttribute('data-cmp-src') ?? '';
      const category = this.resolveCategoryFromElement(iframe, src, 'iframe');
      if (!category || category === 'strictly_necessary') continue;

      if (this.hasConsent(category, consent)) {
        this.activateIframe(iframe);
      } else {
        this.blockIframe(iframe, category);
      }
    }
  }

  private blockIframe(iframe: HTMLIFrameElement, category: string) {
    if (this.blockedIframes.has(iframe)) return;

    const src = iframe.getAttribute('src');
    if (src) {
      iframe.setAttribute('data-cmp-src', src);
      iframe.removeAttribute('src');
    }
    iframe.setAttribute(BLOCKED_ATTR, 'true');
    iframe.style.display = 'none';

    const placeholder = createEmbedPlaceholder(
      category,
      this.categoryNames[category] ?? category,
      this.placeholders[category],
      () => this.onOpenPreferences(),
    );

    iframe.parentNode?.insertBefore(placeholder, iframe);
    this.blockedIframes.set(iframe, placeholder);
  }

  private activateIframe(iframe: HTMLIFrameElement) {
    const placeholder = this.blockedIframes.get(iframe);
    if (placeholder) {
      placeholder.remove();
      this.blockedIframes.delete(iframe);
    }

    const src = iframe.getAttribute('data-cmp-src');
    if (src && !iframe.getAttribute('src')) {
      iframe.setAttribute('src', src);
    }
    iframe.style.display = '';
    iframe.removeAttribute(BLOCKED_ATTR);
  }

  private processPixels(consent?: Record<string, boolean>) {
    const images = document.querySelectorAll<HTMLImageElement>('img');
    for (const img of images) {
      if (isCmpManagedElement(img)) continue;

      const src = img.currentSrc || img.src || '';
      const category = this.resolveCategoryFromElement(img, src, 'pixel');
      if (!category || category === 'strictly_necessary') continue;

      if (this.hasConsent(category, consent)) {
        this.activatePixel(img);
      } else {
        this.blockPixel(img);
      }
    }
  }

  private blockPixel(img: HTMLImageElement) {
    if (this.blockedImages.has(img)) return;
    const src = img.getAttribute('src') ?? img.src;
    if (!src) return;
    this.blockedImages.set(img, src);
    img.setAttribute('data-cmp-src', src);
    img.setAttribute(BLOCKED_ATTR, 'true');
    img.removeAttribute('src');
    img.src = '';
  }

  private activatePixel(img: HTMLImageElement) {
    const original = this.blockedImages.get(img) ?? img.getAttribute('data-cmp-src');
    if (original) {
      img.src = original;
      this.blockedImages.delete(img);
    }
    img.removeAttribute(BLOCKED_ATTR);
  }
}
