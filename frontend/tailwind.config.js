/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7faf2",
          100: "#eef5e5",
          200: "#e3f0cf",
          300: "#cde2a8",
          400: "#a9cf6f",
          500: "#7ab41b",
          600: "#659616",
          700: "#4c730d",
          800: "#38570a",
          900: "#24400a",
        },
        accent: {
          50: "#fff2e2",
          100: "#ffe5c4",
          200: "#ffcf8f",
          300: "#ffb356",
          400: "#ff9e2e",
          500: "#ff9412",
          600: "#e5810a",
          700: "#b96706",
          800: "#8f4f06",
          900: "#663a05",
        },
        ink: {
          DEFAULT: "#171717",
          soft: "#2a2a2a",
          muted: "#74796f",
        },
        surface: "#f5f7f2",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)",
        soft: "0 1px 3px rgba(16,24,40,.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
