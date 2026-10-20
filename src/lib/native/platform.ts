"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNative = () => Capacitor.isNativePlatform();

/** Vibración sutil (nativo) con respaldo web. */
export function haptic(kind: "tap" | "success" | "warn" = "tap") {
  if (isNative()) {
    if (kind === "tap") Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Warning }).catch(() => {});
  } else if (typeof navigator !== "undefined") {
    navigator.vibrate?.(kind === "tap" ? 8 : 20);
  }
}

/** Barra de estado acorde al tema del sistema. */
export function syncStatusBar() {
  if (!isNative()) return;
  const apply = () => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    StatusBar.setBackgroundColor({ color: dark ? "#070B14" : "#F4F6F9" }).catch(() => {});
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  };
  apply();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
}
