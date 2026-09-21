const ALLOWED_TAGS = new Set(['STRONG', 'EM', 'B', 'I', 'A', 'BR', 'P', 'UL', 'OL', 'LI']);

export function sanitizeBasicHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const template = document.createElement('template');
  template.innerHTML = html;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (!ALLOWED_TAGS.has(el.tagName)) return Array.from(el.childNodes).map(walk).join('');
    if (el.tagName === 'BR') return '<br>';
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) return Array.from(el.childNodes).map(walk).join('');
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${Array.from(el.childNodes).map(walk).join('')}</a>`;
    }
    const tag = el.tagName.toLowerCase();
    return `<${tag}>${Array.from(el.childNodes).map(walk).join('')}</${tag}>`;
  };
  return Array.from(template.content.childNodes).map(walk).join('');
}
