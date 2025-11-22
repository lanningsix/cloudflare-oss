/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cf: {
          orange: '#F38020',
          dark: '#1E1E1E',
          gray: '#D9D9D9',
        }
      }
    },
  },
  plugins: [],
}