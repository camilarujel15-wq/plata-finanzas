"use client";

import { useEffect, useRef, useState } from "react";

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
 * Dictado por voz con la Web Speech API (Chrome/Android y Safari iOS 14.5+).
 * El texto final pasa por el mismo intérprete que el registro por texto.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
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

  return {
    supported,
    listening,
    start: () => {
      if (!rec.current) return;
      try {
        rec.current.start();
        setListening(true);
      } catch {
        /* ya estaba escuchando */
      }
    },
    stop: () => rec.current?.stop(),
  };
}
