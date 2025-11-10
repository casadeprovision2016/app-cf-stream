import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5faff",
          100: "#e0f2ff",
          200: "#b9e1ff",
          300: "#7cc7ff",
          400: "#37a9ff",
          500: "#0088f0",
          600: "#006bd1",
          700: "#0052a5",
          800: "#003b79",
          900: "#012b58",
        },
      },
    },
  },
  plugins: [],
};

export default config;
