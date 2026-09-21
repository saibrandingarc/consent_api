import { describe, expect, it, vi } from 'vitest';
import { trapFocus } from './a11y';

describe('trapFocus', () => {
  it('focuses the first focusable element and handles Escape', () => {
    document.body.innerHTML = `
      <div id="modal">
        <button id="first">First</button>
        <button id="last">Last</button>
      </div>
    `;

    const modal = document.getElementById('modal') as HTMLElement;
    const onEscape = vi.fn();
    const release = trapFocus(modal, onEscape);

    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);

    release();
  });
});
