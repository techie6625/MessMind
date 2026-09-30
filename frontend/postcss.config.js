// postcss.config.js
// PostCSS is the CSS processor that runs Tailwind's utility generation.
// This file tells Create React App's webpack to run Tailwind and Autoprefixer
// on every CSS file. Without this, Tailwind classes won't be generated.
module.exports = {
  plugins: {
    tailwindcss: {},    // Runs Tailwind CSS to generate utility classes from our JSX
    autoprefixer: {},   // Adds vendor prefixes (-webkit-, -moz-) for browser compatibility
  },
};
