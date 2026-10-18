"use client";

import { startTransition, useOptimistic } from "react";
import { useToast } from "@/shared/ui/Toast";
import { saveEntryAction } from "../actions";
import { addToTotals, type PeriodTotals } from "../model";
import type { EntryInput, GoalWithProgress } from "../server";
import { EntrySheet } from "./EntrySheet";
import { MoneyHero } from "./MoneyHero";
import { useSheet } from "./useSheet";

/** Денежный блок на главной: счётчик обновляется сразу после добавления дохода. */
export function HomeMoneyHero({
  totals: serverTotals,
  goal,
  currency,
  today,
  recentNotes,
}: {
  totals: PeriodTotals;
  goal?: GoalWithProgress;
  currency: string;
  today: string;
  recentNotes: string[];
}) {
  const [totals, addOptimistic] = useOptimistic(serverTotals, (state, entry: EntryInput) =>
    addToTotals(state, entry, today),
  );
  const sheet = useSheet();
  const toast = useToast();

  return (
    <>
      <MoneyHero
        totals={totals}
        currency={currency}
        today={today}
        goal={goal}
        onAdd={() => sheet.open(undefined)}
        href="/money"
      />
      {sheet.state && (
        <EntrySheet
          key={sheet.state.key}
          open={sheet.state.open}
          today={today}
          currency={currency}
          recentNotes={recentNotes}
          onClose={sheet.close}
          onSave={(input) =>
            startTransition(async () => {
              addOptimistic(input);
              try {
                await saveEntryAction(null, input);
              } catch {
                toast.show({ message: "Не удалось сохранить запись" });
              }
            })
          }
        />
      )}
    </>
  );
}
