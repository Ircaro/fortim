import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5181, open: false, allowedHosts: ['.trycloudflare.com'] },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
