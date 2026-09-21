const BLOCKED_CSS_PATTERNS = [
  /@import/i,
  /expression\s*\(/i,
  /javascript:/i,
  /behavior\s*:/i,
  /url\s*\(\s*["']?\s*data:/i,
];

export function sanitizeBannerCustomCss(css: string | undefined): string {
  if (!css?.trim()) return '';
  for (const pattern of BLOCKED_CSS_PATTERNS) {
    if (pattern.test(css)) return '';
  }
  return css.slice(0, 4000);
}

export function scopeBannerCustomCss(css: string, scopeSelector: string): string {
  const safe = sanitizeBannerCustomCss(css);
  if (!safe) return '';
  return `${scopeSelector} { ${safe} }`;
}
