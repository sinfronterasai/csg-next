import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cosmic: {
          100: 'var(--cosmic-100)',
          200: 'var(--cosmic-200)',
          300: 'var(--cosmic-300)',
          400: 'var(--cosmic-400)',
          500: 'var(--cosmic-500)',
          600: 'var(--cosmic-600)',
          700: 'var(--cosmic-700)',
          800: 'var(--cosmic-800)',
          900: 'var(--cosmic-900)',
          950: 'var(--cosmic-950)',
          primary: 'var(--cosmic-primary)',
          secondary: 'var(--cosmic-secondary)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          300: 'var(--gold-300)',
          400: 'var(--gold-400)',
          600: 'var(--gold-600)',
        },
      },
      keyframes: {
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'spin-medium': 'spin 5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
