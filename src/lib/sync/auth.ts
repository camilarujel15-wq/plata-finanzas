"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { syncNow } from "./engine";
import { useStore } from "../store/store";

export function useCloudUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setReady(true);
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "User already registered": "Ese correo ya tiene cuenta. Inicia sesión.",
  "Email not confirmed": "Confirma tu correo (revisa tu bandeja) y vuelve a intentar.",
  "Password should be at least 6 characters.": "La contraseña debe tener al menos 6 caracteres.",
};
const es = (m: string) => MESSAGES[m] ?? m;

/**
 * Inicia sesión (o crea la cuenta) y sincroniza.
 * Al entrar se marca todo lo local como pendiente: así lo que registraste antes de crear la cuenta
 * también se respalda, y en un celular nuevo se descarga todo lo que había en la nube.
 */
export async function signInAndSync(mode: "signin" | "signup", email: string, password: string): Promise<{ ok: boolean; message?: string; needsConfirm?: boolean }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "La nube no está configurada en esta versión." };
  const res =
    mode === "signup"
      ? await sb.auth.signUp({ email: email.trim(), password })
      : await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (res.error) return { ok: false, message: es(res.error.message) };
  if (!res.data.session) return { ok: false, needsConfirm: true, message: "Te enviamos un correo para confirmar tu cuenta. Confírmala y luego inicia sesión." };
  useStore.getState().markAllDirty();
  useStore.getState().setLastPulledAt(null);
  try {
    await syncNow();
  } catch (e) {
    return { ok: true, message: e instanceof Error ? e.message : undefined };
  }
  return { ok: true };
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}
