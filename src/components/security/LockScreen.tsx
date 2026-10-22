"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { authenticateBiometric, biometryInfo, verifyPin } from "@/lib/security/lock";
import { haptic } from "@/lib/native/platform";
import { getSupabase } from "@/lib/sync/supabase";
import { Sheet } from "@/components/ui/Sheet";
import { PinPad } from "./PinPad";

/** Pantalla de bloqueo: PIN y, si está activado, huella/rostro (se ofrece automáticamente al abrir). */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const lock = useStore((s) => s.settings.lock)!;
  const name = useStore((s) => s.settings.displayName);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [bio, setBio] = useState(false);
  const [forgot, setForgot] = useState(false);
  const length = lock.pinLength ?? 4;

  const tryBio = useCallback(async () => {
    if (await authenticateBiometric()) {
      haptic("success");
      onUnlock();
    }
  }, [onUnlock]);

  useEffect(() => {
    if (!lock.biometric) return;
    biometryInfo().then((b) => {
      setBio(b.available);
      if (b.available) void tryBio();
    });
  }, [lock.biometric, tryBio]);

  useEffect(() => {
    if (pin.length !== length) return;
    if (Date.now() < waitUntil) {
      setPin("");
      return;
    }
    verifyPin(pin, lock).then((ok) => {
      if (ok) {
        haptic("success");
        onUnlock();
        return;
      }
      haptic("warn");
      setError(true);
      const f = fails + 1;
      setFails(f);
      if (f >= 5) setWaitUntil(Date.now() + 30_000);
      setTimeout(() => {
        setError(false);
        setPin("");
      }, 450);
    });
  }, [pin, length, lock, onUnlock, fails, waitUntil]);

  const waiting = Date.now() < waitUntil;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-surface text-ink">
      <div className="pt-safe relative flex flex-1 flex-col items-center justify-center px-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white">
          <Lock size={24} />
        </div>
        <h1 className="text-lg font-semibold">{name ? `Hola, ${name}` : "Plata está bloqueada"}</h1>
        <p className="mb-8 mt-1 text-sm text-muted">{waiting ? "Demasiados intentos. Espera 30 segundos." : bio ? "Usa tu huella/rostro o tu PIN" : "Ingresa tu PIN"}</p>
        <PinPad value={pin} onChange={setPin} length={length} error={error} onBiometric={bio ? tryBio : undefined} />
        <button className="mt-8 text-sm font-medium text-brand" onClick={() => setForgot(true)}>
          ¿Olvidaste tu PIN?
        </button>
      </div>
      <Sheet open={forgot} onClose={() => setForgot(false)} title="Recuperar acceso">
        <ForgotPin onDone={onUnlock} />
      </Sheet>
    </div>
  );
}

/** Si olvidó el PIN: con la cuenta de la nube se verifica la contraseña y se quita el bloqueo. */
function ForgotPin({ onDone }: { onDone: () => void }) {
  const setSettings = useStore((s) => s.setSettings);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const sb = getSupabase();

  useEffect(() => {
    sb?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, [sb]);

  if (!sb || !email) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Sin respaldo en la nube no es posible recuperar el PIN: es lo que protege tus datos. Si reinstalas la app y entras con tu cuenta de respaldo, recuperarás tus datos.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setMsg("Contraseña incorrecta.");
        setSettings({ lock: null });
        onDone();
      }}
    >
      <p className="text-sm text-muted">
        Ingresa la contraseña de tu respaldo (<b>{email}</b>). Se quitará el bloqueo y podrás crear un PIN nuevo en Ajustes.
      </p>
      <input className="input" type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg && <p className="text-sm text-neg">{msg}</p>}
      <button className="btn-primary">Quitar bloqueo</button>
    </form>
  );
}
