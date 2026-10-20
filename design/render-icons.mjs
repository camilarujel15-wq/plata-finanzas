// Genera íconos y splash PNG desde los SVG de /design (requiere Playwright + Chromium).
// Uso: PW=<ruta a playwright> node design/render-icons.mjs
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? "playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const font = fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2")).toString("base64");
const css = `@font-face{font-family:'Plus Jakarta Sans';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}html,body{margin:0;background:transparent}`;
const svg = (f) => fs.readFileSync(path.join(root, "design", f), "utf8");
const res = path.join(root, "android/app/src/main/res");

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svgMarkup, size, out, { round = false, bg = null } = {}) {
  const radius = round ? "50%" : "0";
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>${css}</style><div style="width:${size}px;height:${size}px;border-radius:${radius};overflow:hidden;${bg ? `background:${bg}` : ""}">${svgMarkup.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>`);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  await render(svg("icon.svg"), 48 * k, `${res}/mipmap-${d}/ic_launcher.png`);
  await render(svg("icon.svg").replace('rx="230"', 'rx="512"'), 48 * k, `${res}/mipmap-${d}/ic_launcher_round.png`);
  await render(svg("foreground.svg"), 108 * k, `${res}/mipmap-${d}/ic_launcher_foreground.png`);
}
// Splash (fondo sólido + marca centrada) y PWA
await render(svg("foreground.svg"), 432, `${res}/drawable/splash.png`, { bg: "#0B1220" });
await render(svg("icon.svg"), 192, `${root}/public/icons/icon-192.png`);
await render(svg("icon.svg"), 512, `${root}/public/icons/icon-512.png`);
await render(svg("foreground.svg"), 512, `${root}/public/icons/icon-maskable-512.png`, { bg: "#0B1220" });
fs.copyFileSync(path.join(root, "design/icon.svg"), path.join(root, "public/icon.svg"));
await browser.close();
console.log("ok");
