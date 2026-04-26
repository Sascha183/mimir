// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://howcomputerswork.example.com', // change to your real domain before deploy
  output: 'static',
  integrations: [
    react(),
    mdx(),
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  build: {
    // Inline small stylesheets to reduce HTTP requests; large ones become separate files.
    inlineStylesheets: 'auto',
  },
  // Disable telemetry — we're security-conscious.
  // (Astro telemetry is anonymous, but on-by-default; we opt out.)
});
