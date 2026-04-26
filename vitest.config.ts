import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // `globals: true` lets @testing-library/react auto-register its `cleanup`
    // hook into afterEach, so consecutive renders don't pile up in the DOM.
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
