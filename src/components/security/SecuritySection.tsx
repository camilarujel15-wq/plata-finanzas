"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { Section, Segmented } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/Sheet";
import { authenticateBiometric, biometryInfo, hashPin, newSalt, verifyPin, type BiometryInfo } from "@/lib/security/lock";
import { PinPad } from "./PinPad";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-line"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function SecuritySection() {
  const lock = useStore((s) => s.settings.lock);
  const setSettings = useStore((s) => s.setSettings);
  const toast = useUI((u) => u.toast);
  const [bio, setBio] = useState<BiometryInfo>({ available: false, label: "" });
  const [setup, setSetup] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    biometryInfo().then(setBio);
  }, []);

  return (
    <Section title="Seguridad">
      <div className="card grid gap-4 p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${lock ? "bg-pos/12 text-pos" : "bg-surface-2 text-muted"}`}>
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Bloquear Plata</div>
            <div className="text-xs text-muted">{lock ? `Activo · PIN${lock.biometric ? ` + ${bio.label || "biometría"}` : ""}` : "Pide PIN al abrir la app"}</div>
          </div>
          <Switch label="Bloquear Plata" on={!!lock} onChange={(v) => (v ? setSetup(true) : setDisabling(true))} />
        </div>

        {lock && (
          <>
            {bio.available && (
              <div className="flex items-center justify-between gap-3 border-t border-line/70 pt-4">
                <span>
                  Desbloquear con {bio.label}
                  <span className="block text-xs text-muted">El PIN queda como respaldo</span>
                </span>
                <Switch
                  label="Biometría"
                  on={lock.biometric}
                  onChange={async (v) => {
                    if (v && !(await authenticateBiometric())) return;
                    setSettings({ lock: { ...lock, biometric: v } });
                  }}
                />
              </div>
            )}
            <div className="border-t border-line/70 pt-4">
              <div className="label">Volver a pedir el PIN</div>
              <Segmented
                value={String(lock.graceSeconds)}
                onChange={(v) => setSettings({ lock: { ...lock, graceSeconds: Number(v) } })}
                options={[
                  { value: "0", label: "Siempre" },
                  { value: "60", label: "1 min" },
                  { value: "300", label: "5 min" },
                ]}
              />
              <p className="mt-2 text-xs text-muted">Tiempo fuera de la app antes de bloquearse. Con el bloqueo activo, el widget oculta tu saldo.</p>
            </div>
            <button className="btn-ghost" onClick={() => setSetup(true)}>Cambiar PIN</button>
          </>
        )}
      </div>

      <Sheet open={setup} onClose={() => setSetup(false)} title={lock ? "Nuevo PIN" : "Crea tu PIN"}>
        <PinSetup
          onDone={async (pin) => {
            const salt = newSalt();
            const pinHash = await hashPin(pin, salt);
            setSettings({ lock: { pinHash, salt, pinLength: pin.length, biometric: lock?.biometric ?? bio.available, graceSeconds: lock?.graceSeconds ?? 60 } });
            setSetup(false);
            toast({ title: "Bloqueo activado", body: bio.available ? `También puedes usar tu ${bio.label}.` : "Se pedirá al abrir Plata.", tone: "success" });
          }}
        />
      </Sheet>

      <Sheet open={disabling} onClose={() => setDisabling(false)} title="Desactivar bloqueo">
        {lock && (
          <ConfirmPin
            lock={lock}
            onOk={() => {
              setSettings({ lock: null });
              setDisabling(false);
              toast({ title: "Bloqueo desactivado" });
            }}
          />
        )}
      </Sheet>
    </Section>
  );
}

function PinSetup({ onDone }: { onDone: (pin: string) => void }) {
  const [length, setLength] = useState<"4" | "6">("4");
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const n = Number(length);

  useEffect(() => {
    if (pin.length !== n) return;
    if (first === null) {
      setFirst(pin);
      setPin("");
    } else if (pin === first) {
      onDone(pin);
    } else {
      setError(true);
      setTimeout(() => {
        setError(false);
        setPin("");
        setFirst(null);
      }, 500);
    }
  }, [pin, n, first, onDone]);

  return (
    <div className="pb-2">
      {first === null && (
        <Segmented
          className="mb-5"
          value={length}
          onChange={(v) => {
            setLength(v);
            setPin("");
          }}
          options={[
            { value: "4", label: "4 dígitos" },
            { value: "6", label: "6 dígitos" },
          ]}
        />
      )}
      <p className="mb-5 text-center text-sm font-medium text-muted">{error ? "No coinciden. Empieza de nuevo." : first === null ? "Elige un PIN" : "Repite tu PIN"}</p>
      <PinPad value={pin} onChange={setPin} length={n} error={error} />
    </div>
  );
}

function ConfirmPin({ lock, onOk }: { lock: { pinHash: string; salt: string; pinLength: number }; onOk: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (pin.length !== lock.pinLength) return;
    verifyPin(pin, lock).then((ok) => {
      if (ok) onOk();
      else {
        setError(true);
        setTimeout(() => {
          setError(false);
          setPin("");
        }, 450);
      }
    });
  }, [pin, lock, onOk]);
  return (
    <div className="pb-2">
      <p className="mb-5 text-center text-sm font-medium text-muted">Ingresa tu PIN actual</p>
      <PinPad value={pin} onChange={setPin} length={lock.pinLength} error={error} />
    </div>
  );
}
