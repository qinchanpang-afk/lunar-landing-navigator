/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: { 950: "#05070d", 900: "#0a0e18", 850: "#0e1320", 800: "#131a2a", 700: "#1c2538", 600: "#2a3550" },
        sun: { DEFAULT: "#ffc23d", dim: "#a07a22" },
        earth: { DEFAULT: "#4fa8ff", dim: "#2c5f91" },
        regolith: "#8a8f9c",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
