"use client";

import { ArrowLeftRight } from "lucide-react";
import type { Account, Category, Transaction } from "@/lib/domain/types";
import { TRANSFER_KIND_LABEL } from "@/lib/domain/types";
import { IconBubble } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { useUI } from "@/lib/store/ui";

export function TxRow({
  tx,
  categories,
  accounts,
  hidden,
}: {
  tx: Transaction;
  categories: Map<string, Category>;
  accounts: Map<string, Account>;
  hidden?: boolean;
}) {
  const open = useUI((s) => s.openQuickAdd);
  const cat = tx.categoryId ? categories.get(tx.categoryId) : undefined;
  const acc = accounts.get(tx.accountId);
  const to = tx.toAccountId ? accounts.get(tx.toAccountId) : undefined;
  const isTransfer = tx.type === "transfer";
  const title = isTransfer ? TRANSFER_KIND_LABEL[tx.transferKind ?? "internal"] : tx.merchant || tx.note || cat?.name || "Movimiento";
  const sub = isTransfer ? `${acc?.name ?? "?"} → ${to?.name ?? "?"}` : [tx.merchant || tx.note ? cat?.name : null, acc?.name].filter(Boolean).join(" · ");

  return (
    <button onClick={() => open({ editId: tx.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2">
      {isTransfer ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <ArrowLeftRight size={18} />
        </span>
      ) : (
        <IconBubble icon={cat?.icon ?? "i:help"} color={cat?.color ?? "#94a3b8"} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{title}</div>
        <div className="truncate text-xs text-muted">
          {sub}
          {tx.tags.length > 0 && <span className="ml-1 text-brand">{tx.tags.map((t) => `#${t}`).join(" ")}</span>}
          {tx.source !== "manual" && <span className="ml-1 opacity-70">· {{ voice: "voz", import: "importado", text: "texto", widget: "widget", ocr: "foto", manual: "" }[tx.source]}</span>}
        </div>
      </div>
      <Money
        value={tx.type === "expense" ? -tx.amount : tx.amount}
        sign={tx.type === "income"}
        hidden={hidden}
        currency={acc?.currency}
        className={`text-[15px] font-semibold ${tx.type === "income" ? "text-pos" : isTransfer ? "text-muted" : ""}`}
      />
    </button>
  );
}
