import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (y no esbuild) para conservar los metadatos de decoradores que Nest necesita para inyectar dependencias.
export default defineConfig({
  test: { globals: false, include: ['test/**/*.test.ts', 'src/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000 },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } },
    }),
  ],
});
