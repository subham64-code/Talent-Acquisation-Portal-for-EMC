/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eaf7f0",
          100: "#cdecdc",
          200: "#9dd9bb",
          300: "#66c194",
          400: "#35a873",
          500: "#198754",
          600: "#146c43",
          700: "#105534",
          800: "#0c3f27",
          900: "#08291a",
        },
        accent: {
          50: "#fff4e8",
          100: "#ffe4c7",
          200: "#ffc98f",
          300: "#fbb25c",
          400: "#f79c36",
          500: "#f28c28",
          600: "#d97417",
          700: "#b15a10",
          800: "#8a450d",
          900: "#66330a",
        },
        ink: {
          DEFAULT: "#171717",
          soft: "#2a2a2a",
          muted: "#5c5c5c",
        },
        surface: "#f5f7f6",
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
