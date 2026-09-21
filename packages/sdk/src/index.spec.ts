import { describe, expect, it } from 'vitest';
import { findCmpScript } from './index';

describe('findCmpScript', () => {
  it('finds script by data-domain-key when currentScript is unavailable', () => {
    document.body.innerHTML = '';
    const script = document.createElement('script');
    script.id = 'cmp-sdk';
    script.src = 'https://api.example.com/public/cmp/sdk.js';
    script.setAttribute('data-domain-key', 'dk_test123');
    document.head.appendChild(script);

    expect(findCmpScript()?.getAttribute('data-domain-key')).toBe('dk_test123');
  });
});
