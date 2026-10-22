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

/** Barra de estado siempre clara (la app no tiene modo oscuro). */
export function syncStatusBar() {
  if (!isNative()) return;
  StatusBar.setBackgroundColor({ color: "#F6F7F9" }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
}
