/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",  // Scan HTML
    "./src/**/*.{js,jsx,html}",  // Scan JS/HTML trong src
    "./**/*.html"  // Toàn bộ HTML
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
