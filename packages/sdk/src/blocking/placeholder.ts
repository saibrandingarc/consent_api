import type { EmbedPlaceholderConfig } from './types';
import { DEFAULT_EMBED_PLACEHOLDER } from './types';

const PLACEHOLDER_CLASS = 'cmp-embed-placeholder';

export function createEmbedPlaceholder(
  category: string,
  categoryName: string,
  config?: EmbedPlaceholderConfig,
  onAllow?: () => void,
): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = PLACEHOLDER_CLASS;
  placeholder.setAttribute('data-cmp-placeholder', category);
  placeholder.style.cssText =
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;padding:1.5rem;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:8px;color:#374151;text-align:center;min-height:120px;box-sizing:border-box';

  const title = document.createElement('strong');
  title.textContent = config?.title ?? DEFAULT_EMBED_PLACEHOLDER.title!;

  const description = document.createElement('p');
  description.style.cssText = 'margin:0;font-size:0.875rem;color:#6b7280;max-width:320px';
  description.textContent =
    config?.description ??
    `${categoryName} content is blocked until you grant consent for this category.`;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = config?.allowLabel ?? DEFAULT_EMBED_PLACEHOLDER.allowLabel!;
  button.style.cssText =
    'appearance:none;border:0;border-radius:6px;padding:0.5rem 1rem;background:#2563eb;color:#fff;font-size:0.875rem;font-weight:600;cursor:pointer';
  button.addEventListener('click', () => onAllow?.());

  placeholder.append(title, description, button);
  return placeholder;
}

export function isCmpManagedElement(element: Element): boolean {
  return Boolean(
    element.closest('[data-cmp-banner]') ||
      element.closest('.cmp-banner-root') ||
      element.closest('[data-cmp-placeholder]') ||
      element.closest('[data-cmp-privacy-trigger]') ||
      element.hasAttribute('data-domain-key'),
  );
}
