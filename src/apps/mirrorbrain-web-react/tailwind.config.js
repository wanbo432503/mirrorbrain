/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Fira Code', 'monospace'],
        body: ['Fira Sans', 'sans-serif'],
      },
      fontSize: {
        'hero': 'clamp(3rem, 10vw, 12rem)',
      },
      fontWeight: {
        'ultra': '900',
      },
    },
  },
  plugins: [],
}