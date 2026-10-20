"use client";

import { create } from "zustand";
import type { TxType } from "../domain/types";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "warn" | "success";
  action?: { label: string; run: () => void };
}

interface UIState {
  quickAdd: { open: boolean; type: TxType; editId?: string; text?: string; autoVoice?: boolean; fromAccountId?: string; toAccountId?: string; recurringId?: string; amount?: number; categoryId?: string; note?: string };
  toasts: Toast[];
  openQuickAdd(opts?: { type?: TxType; editId?: string; text?: string; autoVoice?: boolean; fromAccountId?: string; toAccountId?: string; recurringId?: string; amount?: number; categoryId?: string; note?: string }): void;
  closeQuickAdd(): void;
  toast(t: Omit<Toast, "id">, ms?: number): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useUI = create<UIState>((set, get) => ({
  quickAdd: { open: false, type: "expense" },
  toasts: [],
  openQuickAdd: (opts = {}) => set({ quickAdd: { open: true, type: opts.type ?? "expense", ...opts } }),
  closeQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false, editId: undefined, text: undefined, autoVoice: false, fromAccountId: undefined, toAccountId: undefined, recurringId: undefined, amount: undefined, categoryId: undefined, note: undefined } })),
  toast: (t, ms = 4500) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
