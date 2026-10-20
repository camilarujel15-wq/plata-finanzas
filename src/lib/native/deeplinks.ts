"use client";

import { App } from "@capacitor/app";
import { isNative } from "./platform";

/** plata://voice (botón "Dictar" del widget) y plata://add. */
export function listenDeepLinks(handler: (action: "voice" | "add") => void) {
  if (!isNative()) return () => {};
  const route = (url?: string) => {
    if (!url) return;
    if (url.startsWith("plata://voice")) handler("voice");
    else if (url.startsWith("plata://add")) handler("add");
  };
  App.getLaunchUrl().then((r) => route(r?.url)).catch(() => {});
  const sub = App.addListener("appUrlOpen", (e) => route(e.url));
  return () => {
    sub.then((h) => h.remove());
  };
}
