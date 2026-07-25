/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: { 300:'#56fff9', 400:'#0ff4ef', 500:'#00d4d6', 600:'#00a8b5', 700:'#008492' },
        dark:  { 600:'#1c2844', 700:'#151e35', 800:'#0f1629', 900:'#0a0e1a' },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}
