"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Segmented } from "@/components/ui/bits";
import { signInAndSync } from "@/lib/sync/auth";
import { useUI } from "@/lib/store/ui";

/** Formulario de respaldo en la nube (correo + contraseña). */
export function CloudLogin({ initialMode = "signup", onDone }: { initialMode?: "signin" | "signup"; onDone?: () => void }) {
  const toast = useUI((u) => u.toast);
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg("");
        const r = await signInAndSync(mode, email, password);
        setBusy(false);
        if (r.ok) {
          toast({ title: mode === "signup" ? "Respaldo activado" : "Datos restaurados", body: "Tus datos se sincronizan automáticamente.", tone: "success" });
          onDone?.();
        } else {
          setMsg(r.message ?? "No se pudo conectar.");
          if (r.needsConfirm) setMode("signin");
        }
      }}
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "signup", label: "Crear cuenta" },
          { value: "signin", label: "Ya tengo cuenta" },
        ]}
      />
      <input className="input" type="email" required autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="relative">
        <input
          className="input pr-12"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="Contraseña (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" aria-label={show ? "Ocultar" : "Mostrar"} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {msg && <p className="rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">{msg}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Conectando…" : mode === "signup" ? "Activar respaldo" : "Entrar y restaurar"}
      </button>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" />
        Tus datos viajan cifrados y solo tú puedes verlos. Al cambiar de celular, entra con el mismo correo y todo vuelve.
      </p>
    </form>
  );
}
