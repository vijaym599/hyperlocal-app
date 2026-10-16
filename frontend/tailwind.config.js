
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--neo-canvas)',
        surface: 'var(--neo-surface)',
        ink: 'var(--neo-text)',
        muted: 'var(--neo-muted)',
        brand: 'var(--neo-accent)',
      },
      borderRadius: {
        soft: 'var(--neo-radius)',
      },
      boxShadow: {
        soft: 'var(--neo-shadow-raised)',
        'soft-sm': 'var(--neo-shadow-raised-sm)',
        inset: 'var(--neo-shadow-inset)',
        pressed: 'var(--neo-shadow-pressed)',
      },
    },
  },
  plugins: [],
}
