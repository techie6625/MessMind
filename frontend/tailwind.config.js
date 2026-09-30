/** @type {import('tailwindcss').Config} */
// tailwind.config.js — Tailwind CSS Configuration
// The 'content' array tells Tailwind WHERE to look for class names.
// Tailwind scans these files and ONLY includes CSS for classes it finds.
// This keeps the final CSS bundle tiny (tree-shaking for CSS).
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // All JS/JSX files in the src folder
    "./public/index.html"         // The HTML entry point
  ],
  theme: {
    extend: {}, // Add custom design tokens here if needed (colors, fonts, etc.)
  },
  plugins: [], // Add Tailwind plugins here (e.g., @tailwindcss/forms)
}
