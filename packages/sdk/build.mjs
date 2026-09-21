import esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/sdk.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  sourcemap: true,
});

await esbuild.build({
  entryPoints: ['src/browser-test.ts'],
  outfile: 'dist/browser-test.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: false,
});

console.log('Built dist/sdk.js and dist/browser-test.js');
