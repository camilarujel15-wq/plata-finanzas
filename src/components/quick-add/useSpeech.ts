"use client";

import { useEffect, useRef, useState } from "react";
import { SpeechRecognition as NativeSpeech } from "@capacitor-community/speech-recognition";
import { isNative } from "@/lib/native/platform";

/* Tipos mínimos de la Web Speech API (no incluidos en lib.dom de TS). */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

/**
 * Dictado por voz.
 * - App Android: reconocimiento nativo del sistema (Google), funciona aunque el WebView no lo soporte.
 * - Web: Web Speech API (Chrome y Safari).
 * El texto final pasa por el mismo intérprete que el registro por texto.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    if (isNative()) {
      NativeSpeech.available()
        .then((r) => setSupported(r.available))
        .catch(() => setSupported(false));
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "es-PE";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) cb.current(last[0].transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setSupported(true);
    return () => r.stop();
  }, []);

  const startNative = async () => {
    const perm = await NativeSpeech.checkPermissions();
    if (perm.speechRecognition !== "granted") {
      const req = await NativeSpeech.requestPermissions();
      if (req.speechRecognition !== "granted") return;
    }
    setListening(true);
    try {
      const res = await NativeSpeech.start({
        language: "es-PE",
        maxResults: 1,
        prompt: "Di tu gasto: “18 soles almuerzo”",
        partialResults: false,
        popup: true,
      });
      const text = res.matches?.[0];
      if (text) cb.current(text);
    } catch {
      /* cancelado por el usuario */
    } finally {
      setListening(false);
    }
  };

  return {
    supported,
    listening,
    start: () => {
      if (isNative()) {
        void startNative();
        return;
      }
      if (!rec.current) return;
      try {
        rec.current.start();
        setListening(true);
      } catch {
        /* ya estaba escuchando */
      }
    },
    stop: () => {
      if (isNative()) NativeSpeech.stop().catch(() => {});
      else rec.current?.stop();
    },
  };
}
