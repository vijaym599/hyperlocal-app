
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--ui-canvas)',
        surface: 'var(--ui-surface)',
        ink: 'var(--ui-text)',
        muted: 'var(--ui-muted)',
        brand: 'var(--ui-accent)',
      },
      borderRadius: {
        soft: 'var(--ui-radius)',
      },
      boxShadow: {
        soft: 'var(--ui-shadow)',
        'soft-sm': 'var(--ui-shadow-sm)',
        inset: 'var(--ui-shadow-inset)',
        pressed: 'var(--ui-shadow-pressed)',
      },
    },
  },
  plugins: [],
}
