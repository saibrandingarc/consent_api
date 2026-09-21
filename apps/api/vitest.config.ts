import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@cmp/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@cmp/auth': path.resolve(__dirname, '../../packages/auth/src/index.ts'),
      '@cmp/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
    },
  },
});
