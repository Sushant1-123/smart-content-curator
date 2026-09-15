import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6ff",
          100: "#e6ecff",
          500: "#4f5bff",
          600: "#3c46e0",
          700: "#2f38b3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
