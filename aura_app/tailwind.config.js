/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / .04), 0 1px 3px rgb(16 24 40 / .06)',
        pop: '0 20px 50px -12px rgb(30 27 75 / .25)',
        glow: '0 0 0 1px rgb(var(--brand) / .15), 0 10px 40px -10px rgb(var(--brand) / .55)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: .55 }, '50%': { transform: 'scale(1.08)', opacity: .9 } },
        ping2: { '0%': { transform: 'scale(1)', opacity: .6 }, '100%': { transform: 'scale(2.4)', opacity: 0 } },
      },
      animation: {
        shimmer: 'shimmer 6s linear infinite',
        breathe: 'breathe 4s ease-in-out infinite',
        ping2: 'ping2 2s cubic-bezier(0,0,.2,1) infinite',
      },
    },
  },
  plugins: [],
}
