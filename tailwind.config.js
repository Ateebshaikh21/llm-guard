/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        cyber: {
          bg: '#070b14',
          panel: '#0d1424',
          surface: '#111a2e',
          border: '#1e2a44',
          primary: '#00e5ff',
          accent: '#7c5cff',
          success: '#22d39a',
          warning: '#ffb020',
          danger: '#ff4d6d',
          text: '#e6edf7',
          muted: '#8a9bbd',
        },
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 20% 0%, rgba(0,229,255,0.08), transparent 40%), radial-gradient(circle at 80% 100%, rgba(124,92,255,0.08), transparent 40%)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(0,229,255,0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0,229,255,0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 2s infinite',
        slideIn: 'slideIn 0.35s ease-out',
        scanline: 'scanline 3s linear infinite',
      },
    },
  },
  plugins: [],
};
