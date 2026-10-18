"use client";

import { ChevronsUpDown, Coins } from "lucide-react";
import { startTransition, useOptimistic } from "react";
import { CURRENCIES, currencySymbol } from "@/shared/lib/money";
import { useToast } from "@/shared/ui/Toast";
import { setCurrencyAction } from "../actions";

/** Строка настроек с нативным выбором валюты (на iOS — колесо выбора). */
export function CurrencySelect({ value: serverValue }: { value: string }) {
  const [value, setOptimistic] = useOptimistic(serverValue);
  const toast = useToast();
  const current = CURRENCIES.find((c) => c.code === value);

  return (
    <label className="relative mx-6 flex min-h-14 items-center gap-3 rounded-[20px] bg-surface px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <Coins size={16} />
      </span>
      <span className="flex-1 text-[15px] font-medium">Валюта</span>
      <span className="flex items-center gap-1 text-[15px] font-semibold text-muted-2">
        {current?.name ?? value} · {currencySymbol(value)}
        <ChevronsUpDown size={15} />
      </span>
      <select
        value={value}
        aria-label="Валюта"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            setOptimistic(next);
            try {
              await setCurrencyAction(next);
            } catch {
              toast.show({ message: "Не удалось сменить валюту" });
            }
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.code})
          </option>
        ))}
      </select>
    </label>
  );
}
