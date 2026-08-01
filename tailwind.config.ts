import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cosmic: {
          950: 'var(--cosmic-950)',
          900: 'var(--cosmic-900)',
          800: 'var(--cosmic-800)',
          700: 'var(--cosmic-700)',
          600: 'var(--cosmic-600)',
          primary: 'var(--cosmic-primary)',
          secondary: 'var(--cosmic-secondary)',
        },
        gold: 'var(--gold)',
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
