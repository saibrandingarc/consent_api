import { describe, expect, it, vi } from 'vitest';
import { NetworkInterceptor } from './network-interceptor';

describe('NetworkInterceptor', () => {
  it('returns a valid empty Response when blocking fetch', async () => {
    const log = { record: vi.fn() };
    const interceptor = new NetworkInterceptor({
      evaluate: () => ({
        action: 'block',
        rule: { category: 'analytics', pattern: 'example.com', type: 'fetch', vendor: null },
      }),
      log,
    });

    const response = await window.fetch('https://analytics.example.com/track');
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();

    interceptor.destroy();
  });
});
