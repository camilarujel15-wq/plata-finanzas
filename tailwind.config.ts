import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class", // la app es siempre clara
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("brand"),
        "brand-strong": token("brand-strong"),
        "brand-soft": token("brand-soft"),
        "brand-ink": token("brand-ink"),
        pos: token("pos"),
        neg: token("neg"),
        warn: token("warn"),
      },
      fontFamily: { sans: ["var(--font-sans)"] },
      opacity: { 7: "0.07", 8: "0.08", 12: "0.12", 65: "0.65" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / .05)",
        float: "0 8px 30px -8px rgb(var(--shadow) / .18)",
        glow: "none",
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: { "0%": { transform: "scale(.96) translateY(6px)", opacity: "0" }, "100%": { transform: "scale(1) translateY(0)", opacity: "1" } },
        shake: { "0%,100%": { transform: "translateX(0)" }, "25%": { transform: "translateX(-6px)" }, "75%": { transform: "translateX(6px)" } },
        rise: { from: { transform: "translateY(8px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
      },
      animation: {
        "sheet-up": "sheet-up .28s cubic-bezier(.2,.9,.25,1)",
        "fade-in": "fade-in .18s ease-out",
        pop: "pop .22s cubic-bezier(.2,.9,.25,1)",
        shake: "shake .3s ease-in-out",
        rise: "fade-in .2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
