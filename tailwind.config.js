/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        landscape: { raw: '(orientation: landscape)' },
        portrait: { raw: '(orientation: portrait)' },
      },
      transform: ['responsive', 'hover', 'focus'],
      transitionProperty: ['responsive', 'hover', 'focus'],
    },
  },
  plugins: [],
};
