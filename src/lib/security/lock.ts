"use client";

import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { isNative } from "../native/platform";

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** PIN → hash PBKDF2-SHA256 con sal (nunca se guarda el PIN en claro). */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 120_000 }, key, 256);
  return hex(bits);
}

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

export async function verifyPin(pin: string, lock: { pinHash: string; salt: string }) {
  return (await hashPin(pin, lock.salt)) === lock.pinHash;
}

export interface BiometryInfo {
  available: boolean;
  label: string;
}

/** ¿El celular tiene huella o rostro registrados? */
export async function biometryInfo(): Promise<BiometryInfo> {
  if (!isNative()) return { available: false, label: "" };
  try {
    const r = await BiometricAuth.checkBiometry();
    const types = r.biometryTypes?.length ? r.biometryTypes : [r.biometryType];
    const face = types.includes(BiometryType.faceAuthentication);
    const finger = types.includes(BiometryType.fingerprintAuthentication);
    return { available: r.isAvailable, label: face && finger ? "huella o rostro" : face ? "rostro" : "huella" };
  } catch {
    return { available: false, label: "" };
  }
}

/** Muestra el diálogo biométrico del sistema. Devuelve true si se reconoció a la persona. */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason: "Desbloquea Plata",
      androidTitle: "Desbloquear Plata",
      androidSubtitle: "Usa tu huella o rostro",
      cancelTitle: "Usar PIN",
      allowDeviceCredential: false,
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false;
  }
}
