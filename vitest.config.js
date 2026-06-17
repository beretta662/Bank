import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      all: true,
      include: ['server.js'],
      exclude: ['**/*.test.js', '**/*.spec.js', 'node_modules/**', 'bank-frontend/**', 'coverage/**']
    }
  }
});
