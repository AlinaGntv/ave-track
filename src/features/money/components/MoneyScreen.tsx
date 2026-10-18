"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { startTransition, useCallback, useOptimistic, useRef } from "react";
import { useQuickAddHandler } from "@/features/tasks/components/TaskEditorProvider";
import { formatDate } from "@/shared/lib/dates";
import { formatMoney } from "@/shared/lib/money";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";
import { useToast } from "@/shared/ui/Toast";
import { deleteEntryAction, deleteGoalAction, saveEntryAction, saveGoalAction } from "../actions";
import {
  goalProgress,
  groupEntriesByMonth,
  monthlyTotals,
  periodTotals,
  type GoalItem,
  type MoneyEntryItem,
} from "../model";
import { EntrySheet } from "./EntrySheet";
import { GoalCard } from "./GoalCard";
import { GoalSheet } from "./GoalSheet";
import { MoneyHero } from "./MoneyHero";
import { MonthlyChart } from "./MonthlyChart";
import { useSheet } from "./useSheet";

type Op<T> = { type: "upsert"; item: T } | { type: "remove"; id: number };

function reducer<T extends { id: number }>(state: T[], op: Op<T>): T[] {
  if (op.type === "remove") return state.filter((x) => x.id !== op.id);
  const i = state.findIndex((x) => x.id === op.item.id);
  return i < 0 ? [...state, op.item] : state.map((x) => (x.id === op.item.id ? op.item : x));
}

let tempId = 0;
const nextTempId = () => --tempId;

export function MoneyScreen({
  entries: serverEntries,
  goals: serverGoals,
  currency,
  today,
  recentNotes,
}: {
  entries: MoneyEntryItem[];
  goals: GoalItem[];
  currency: string;
  today: string;
  recentNotes: string[];
}) {
  const [entries, applyEntry] = useOptimistic(serverEntries, reducer<MoneyEntryItem>);
  const [goals, applyGoal] = useOptimistic(serverGoals, reducer<GoalItem>);
  const entrySheet = useSheet<MoneyEntryItem | undefined>();
  const goalSheet = useSheet<GoalItem | undefined>();
  const toast = useToast();
  // Настоящий id → временный: запись сохраняет React-key после ответа сервера и не «мигает»
  const tempKeys = useRef(new Map<number, number>());

  useQuickAddHandler(() => entrySheet.open(undefined));

  const run = useCallback(
    (optimistic: () => void, action: () => Promise<unknown>) =>
      startTransition(async () => {
        optimistic();
        try {
          await action();
        } catch {
          toast.show({ message: "Не удалось сохранить изменения" });
        }
      }),
    [toast],
  );

  // Всё ниже считается из оптимистичных записей — счётчик, график и цели обновляются мгновенно
  const totals = periodTotals(entries, today);
  const months = monthlyTotals(entries, today);
  const groups = groupEntriesByMonth(entries);
  const goalItems = goals.map((goal) => ({ goal, progress: goalProgress(goal, entries, today) }));
  const heroGoal = goalItems.find((g) => !g.progress.achieved) ?? goalItems[0];

  return (
    <>
      <ScreenHeader
        caption="Трекер"
        title="Деньги"
        right={
          <Pressable
            aria-label="Добавить доход"
            onClick={() => entrySheet.open(undefined)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink"
          >
            <Plus size={20} />
          </Pressable>
        }
      />

      <MoneyHero
        totals={totals}
        currency={currency}
        today={today}
        goal={heroGoal && { ...heroGoal.goal, progress: heroGoal.progress }}
        onAdd={() => entrySheet.open(undefined)}
      />

      <SectionTitle title="По месяцам" />
      <MonthlyChart months={months} currency={currency} />

      <SectionTitle
        title="Цели"
        right={
          <Pressable
            onClick={() => goalSheet.open(undefined)}
            className="-mr-3 h-11 px-3 text-[13px] font-semibold text-muted-2"
          >
            Добавить
          </Pressable>
        }
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
        {goalItems.map(({ goal, progress }, i) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            progress={progress}
            currency={currency}
            primary={i === 0}
            onOpen={() => goal.id > 0 && goalSheet.open(goal)}
          />
        ))}
        <Pressable
          onClick={() => goalSheet.open(undefined)}
          className="flex h-[208px] w-[150px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-[30px] border border-dashed border-line text-[13px] font-semibold text-muted-2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg">
            <Plus size={20} />
          </span>
          {goalItems.length ? "Новая цель" : "Поставить цель"}
        </Pressable>
      </div>

      <SectionTitle title="Записи" />
      {groups.length === 0 && (
        <p className="px-6 py-6 text-center text-[15px] font-medium text-muted">
          Пока пусто. Нажмите «+», чтобы добавить первый доход.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.month} className="mb-5 px-4">
          <div className="flex items-baseline justify-between px-2 pb-2.5">
            <h3 className="text-[15px] font-bold">{group.title}</h3>
            <span className="text-[13px] font-semibold text-muted-2 tabular-nums">
              {formatMoney(group.total, currency)}
            </span>
          </div>
          <ul className="relative flex flex-col gap-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {group.entries.map((entry) => (
                <motion.li
                  key={tempKeys.current.get(entry.id) ?? entry.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={spring.smooth}
                >
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    transition={spring.snappy}
                    onClick={() => entry.id > 0 && entrySheet.open(entry)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-card px-5 py-3 text-left shadow-soft"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {entry.note ?? <span className="text-muted">Без комментария</span>}
                      </span>
                      <span className="block text-[12px] text-muted-2">{formatDate(entry.date, "d MMMM, EEEEEE")}</span>
                    </span>
                    <span className="shrink-0 text-[16px] font-bold tabular-nums">
                      +{formatMoney(entry.amountCents, currency)}
                    </span>
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}

      {entrySheet.state && (
        <EntrySheet
          key={entrySheet.state.key}
          open={entrySheet.state.open}
          entry={entrySheet.state.data}
          today={today}
          currency={currency}
          recentNotes={recentNotes}
          onClose={entrySheet.close}
          onSave={(input) => {
            const existing = entrySheet.state?.data;
            const id = existing?.id ?? nextTempId();
            run(
              () => applyEntry({ type: "upsert", item: { id, ...input } }),
              async () => {
                const realId = await saveEntryAction(existing?.id ?? null, input);
                if (!existing) tempKeys.current.set(realId, id);
              },
            );
          }}
          onDelete={
            entrySheet.state.data
              ? () => {
                  const id = entrySheet.state!.data!.id;
                  run(() => applyEntry({ type: "remove", id }), () => deleteEntryAction(id));
                }
              : undefined
          }
        />
      )}

      {goalSheet.state && (
        <GoalSheet
          key={goalSheet.state.key}
          open={goalSheet.state.open}
          goal={goalSheet.state.data}
          today={today}
          currency={currency}
          onClose={goalSheet.close}
          onSave={(input) => {
            const existing = goalSheet.state?.data;
            run(
              () => applyGoal({ type: "upsert", item: { id: existing?.id ?? nextTempId(), ...input } }),
              () => saveGoalAction(existing?.id ?? null, input),
            );
          }}
          onDelete={
            goalSheet.state.data
              ? () => {
                  const id = goalSheet.state!.data!.id;
                  run(() => applyGoal({ type: "remove", id }), () => deleteGoalAction(id));
                }
              : undefined
          }
        />
      )}
    </>
  );
}
