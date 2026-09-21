function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const transform = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function getContrastRatio(foreground: string, background: string): number | null {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAA(foreground: string, background: string, largeText = false): boolean | null {
  const ratio = getContrastRatio(foreground, background);
  if (ratio === null) return null;
  return ratio >= (largeText ? 3 : 4.5);
}

export interface ContrastWarning {
  pair: string;
  ratio: number | null;
  passes: boolean | null;
}

export function getBannerContrastWarnings(theme: {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonTextColor?: string;
}): ContrastWarning[] {
  const primary = theme.primaryColor ?? '#2563eb';
  const background = theme.backgroundColor ?? '#ffffff';
  const text = theme.textColor ?? '#111827';
  const buttonText = theme.buttonTextColor ?? '#ffffff';

  const checks: Array<{ pair: string; fg: string; bg: string; large?: boolean }> = [
    { pair: 'Text on background', fg: text, bg: background },
    { pair: 'Button text on primary', fg: buttonText, bg: primary },
    { pair: 'Primary links on background', fg: primary, bg: background, large: true },
  ];

  return checks.map(({ pair, fg, bg, large }) => {
    const ratio = getContrastRatio(fg, bg);
    const passes = meetsWcagAA(fg, bg, large);
    return { pair, ratio, passes };
  });
}
