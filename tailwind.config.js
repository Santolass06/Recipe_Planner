/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#fdf6ee",
          100: "#faebd7",
          200: "#f3d0a8",
          300: "#eab176",
          400: "#e09050",
          500: "#d4733a",
          600: "#bc5a2e",
          700: "#9c4327",
          800: "#7e3725",
          900: "#672f22",
        }
      }
    },
  },
  plugins: [],
}
