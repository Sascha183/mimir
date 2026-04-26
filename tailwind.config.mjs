/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-inspired palette. Single restrained accent (apple-blue) for links/CTAs.
        'apple-bg': '#fbfbfd',
        'apple-text': '#1d1d1f',
        'apple-text-secondary': '#6e6e73',
        'apple-border': '#d2d2d7',
        'apple-blue': '#0071e3',

        // Semantic colors for gate visualization.
        // Color is paired with text labels so it's never the only signal.
        'signal-on': '#0071e3', // apple-blue — "powered"
        'signal-off': '#e8e8ed', // light neutral — "unpowered"
      },
      fontFamily: {
        // System font stack — matches Apple's SF Pro on Apple devices and falls back gracefully elsewhere.
        // No external font load: stays inside the strict CSP and ships zero font bytes.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
