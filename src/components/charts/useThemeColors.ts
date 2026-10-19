"use client";

import { useEffect, useState } from "react";

const KEYS = ["ink", "muted", "line", "surface", "surface-2", "brand", "pos", "neg", "warn"] as const;
type Colors = Record<(typeof KEYS)[number], string>;

const FALLBACK: Colors = {
  ink: "rgb(15,23,42)", muted: "rgb(100,116,139)", line: "rgb(226,230,235)", surface: "rgb(255,255,255)",
  "surface-2": "rgb(240,242,245)", brand: "rgb(22,163,74)", pos: "rgb(22,163,74)", neg: "rgb(220,38,38)", warn: "rgb(217,119,6)",
};

/** Resuelve los tokens CSS a colores concretos (los atributos SVG de Recharts no aceptan var()). */
export function useThemeColors(): Colors {
  const [colors, setColors] = useState<Colors>(FALLBACK);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const next = { ...FALLBACK };
      for (const k of KEYS) {
        const v = cs.getPropertyValue(`--${k}`).trim();
        if (v) next[k] = `rgb(${v.split(/\s+/).join(",")})`;
      }
      setColors(next);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return colors;
}
