import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
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
        "brand-ink": token("brand-ink"),
        pos: token("pos"),
        neg: token("neg"),
        warn: token("warn"),
      },
      fontFamily: { sans: ["var(--font-sans)"] },
      opacity: { 7: "0.07", 8: "0.08", 12: "0.12", 65: "0.65" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / .04), 0 10px 28px -14px rgb(var(--shadow) / .12)",
        float: "0 12px 40px -12px rgb(var(--shadow) / .28)",
        glow: "0 10px 24px -10px rgba(16,185,129,.55)",
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
        rise: "rise .35s cubic-bezier(.2,.9,.25,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
