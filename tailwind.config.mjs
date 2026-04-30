/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  // Manual class-based dark mode. The `dark` class is set on <html> by the
  // ThemeBoot component before paint, driven by localStorage `hciw-theme` and
  // (on first visit) prefers-color-scheme. Users toggle via ThemeToggle.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Apple-inspired palette, driven by CSS custom properties so that
        // setting `.dark` on <html> swaps the light values for dark ones
        // without requiring `dark:` modifiers throughout the codebase.
        // The `<alpha-value>` placeholder lets utilities like `bg-apple-bg/80`
        // continue to work; the variables are stored as space-separated RGB
        // triples (e.g. `251 251 253`) in src/styles/theme.css.
        'apple-bg': 'rgb(var(--apple-bg) / <alpha-value>)',
        'apple-text': 'rgb(var(--apple-text) / <alpha-value>)',
        'apple-text-secondary': 'rgb(var(--apple-text-secondary) / <alpha-value>)',
        'apple-border': 'rgb(var(--apple-border) / <alpha-value>)',
        'apple-blue': 'rgb(var(--apple-blue) / <alpha-value>)',

        // Surface = card / panel background. White in light mode, near-black
        // in dark. Use this anywhere you'd reach for `bg-white`.
        'apple-surface': 'rgb(var(--apple-surface) / <alpha-value>)',
        // Frame = widget-canvas inner background (lighter than the page).
        // In light mode this is the soft `#f5f5f7`; in dark mode a slightly
        // raised dark surface so widget frames remain visually distinct.
        'apple-frame': 'rgb(var(--apple-frame) / <alpha-value>)',

        // Semantic colors for gate visualization.
        // Color is paired with text labels so it's never the only signal.
        'signal-on': 'rgb(var(--apple-blue) / <alpha-value>)',
        'signal-off': 'rgb(var(--signal-off) / <alpha-value>)',
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
