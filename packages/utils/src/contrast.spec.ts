import { describe, expect, it } from 'vitest';
import { getBannerContrastWarnings, getContrastRatio, meetsWcagAA } from './contrast';
import { sanitizeBannerCustomCss } from './banner-css';

describe('contrast utilities', () => {
  it('calculates contrast ratio for hex colors', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('flags low-contrast button pairs', () => {
    const warnings = getBannerContrastWarnings({
      primaryColor: '#ffff00',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      buttonTextColor: '#ffff00',
    });
    expect(warnings.some((warning) => warning.pair === 'Button text on primary' && warning.passes === false)).toBe(
      true,
    );
  });

  it('passes accessible text on background', () => {
    expect(meetsWcagAA('#111827', '#ffffff')).toBe(true);
  });
});

describe('sanitizeBannerCustomCss', () => {
  it('blocks dangerous css', () => {
    expect(sanitizeBannerCustomCss('@import url("x.css")')).toBe('');
    expect(sanitizeBannerCustomCss('border-width: 2px;')).toBe('border-width: 2px;');
  });
});
