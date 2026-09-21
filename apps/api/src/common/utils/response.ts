import type { ApiResponse } from '@cmp/types';

export function ok<T>(data: T, requestId?: string): ApiResponse<T> {
  return { ok: true, data, ...(requestId ? { requestId } : {}) };
}
