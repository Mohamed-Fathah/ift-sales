/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF0FA',
          100: '#CDD1F0',
          200: '#ABB2E6',
          300: '#6A75D2',
          400: '#3A4BBF',
          500: '#1B2A6B',   // IFT Navy — primary
          600: '#162259',
          700: '#111A46',
          800: '#0C1233',
          900: '#070B21',
        },
        gold: {
          50:  '#FDF3E0',
          100: '#FAE1A8',
          400: '#E8A832',
          500: '#C8922A',   // IFT Gold
          700: '#8A6019',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
