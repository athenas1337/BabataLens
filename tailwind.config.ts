import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080C15",
        surface: {
          DEFAULT: "#0E1524",
          subtle: "#131C30",
          card: "#162036",
          border: "#1E2C4A",
          hover: "#1A2640",
        },
        babata: {
          glow: "#38BDF8",
          neon: "#00F0FF",
          purple: "#818CF8",
          deep: "#4F46E5",
          accent: "#06B6D4",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
