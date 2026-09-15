/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#080c14',
          surface: '#0d131f',
          card: '#131b2e',
          cardHover: '#18223a',
          border: '#1f293d',
          borderLight: '#2a3752',
          text: '#f1f5f9',
          muted: '#94a3b8'
        },
        brand: {
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          secondary: '#38bdf8',
          accent: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e'
        }
      }
    }
  },
  plugins: [],
};
