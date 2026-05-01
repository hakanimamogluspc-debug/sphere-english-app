/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        fog: '#F4F5F7',
        aluminum: '#D1D5DB',
        charcoal: '#1C2340',
        sapphire: {
          DEFAULT: '#082567',
          dark: '#051840',
          light: '#EEF2FB',
          mid: '#1A3A8F',
        },
        blue: {
          DEFAULT: '#082567',
          dark: '#051840',
          light: '#EEF2FB',
        },
        green: {
          DEFAULT: '#86BC25',
          light: '#F0F7E0',
        },
        card: '#FFFFFF',
        dark: '#0A1535',
        muted: '#6B7280',
        anthracite: '#3D4454',
        border: '#E5E7EB',
      },
      maxWidth: {
        '8xl': '90rem',
      },
      animation: {
        'fill-bar': 'fillBar 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
      keyframes: {
        fillBar: {
          from: { width: '0' },
          to: { width: '100%' },
        },
      },
    },
  },
  plugins: [],
};