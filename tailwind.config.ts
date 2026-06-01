import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0a',
          card: '#111111',
          elevated: '#1a1a1a',
        },
        border: {
          DEFAULT: '#222222',
          hover: '#333333',
        },
        accent: {
          red: '#ff4444',
          'red-dim': 'rgba(255,68,68,0.1)',
          'red-glow': 'rgba(255,68,68,0.15)',
          green: '#22c55e',
          yellow: '#f59e0b',
          orange: '#f97316',
        },
        text: {
          primary: '#ffffff',
          secondary: '#888888',
          muted: '#555555',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(255,68,68,0.1)' },
          '100%': { boxShadow: '0 0 30px rgba(255,68,68,0.25)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
