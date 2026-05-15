import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // cucu brand palette — warm cream, deep ink, signal coral
        ink: {
          50: "#f5f3ef",
          100: "#e7e3dc",
          200: "#cbc6bc",
          300: "#9d9789",
          400: "#6d6757",
          500: "#403c33",
          600: "#2b2823",
          700: "#1a1816",
          800: "#100f0d",
          900: "#080806",
        },
        cream: {
          50: "#fffefb",
          100: "#fbf8f1",
          200: "#f6f1e6",
          300: "#ede5d2",
          400: "#dccfaf",
          500: "#c4b285",
        },
        signal: {
          50: "#fff1ec",
          100: "#ffd8c8",
          200: "#ffaf8c",
          300: "#ff8255",
          400: "#ff5a29",
          500: "#f24016",
          600: "#cd2f0c",
          700: "#a8260a",
          800: "#7d1d08",
          900: "#591406",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-instrument)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.4" },
          "80%, 100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "marquee-dot": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.215,0.61,0.355,1) infinite",
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
