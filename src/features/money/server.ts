import { desc, eq, isNotNull, max } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";
import {
  goalProgress,
  periodTotals,
  type GoalItem,
  type GoalPeriod,
  type GoalProgress,
  type MoneyEntryItem,
  type PeriodTotals,
} from "./model";

const e = schema.moneyEntries;
const g = schema.moneyGoals;

export type EntryInput = Omit<MoneyEntryItem, "id">;
export type GoalInput = Omit<GoalItem, "id">;
export type GoalWithProgress = GoalItem & { progress: GoalProgress };

export function getEntries(): MoneyEntryItem[] {
  return getDb()
    .select({ id: e.id, amountCents: e.amountCents, date: e.date, note: e.note })
    .from(e)
    .orderBy(desc(e.date), desc(e.id))
    .all();
}

export function saveEntry(id: number | null, input: EntryInput): number {
  const db = getDb();
  if (id != null) {
    db.update(e).set(input).where(eq(e.id, id)).run();
    return id;
  }
  return db.insert(e).values(input).returning({ id: e.id }).get().id;
}

export function deleteEntry(id: number): void {
  getDb().delete(e).where(eq(e.id, id)).run();
}

/** Последние уникальные комментарии — быстрые подсказки источника дохода. */
export function getRecentNotes(limit = 6): string[] {
  return getDb()
    .select({ note: e.note, last: max(e.date) })
    .from(e)
    .where(isNotNull(e.note))
    .groupBy(e.note)
    .orderBy(desc(max(e.date)))
    .limit(limit)
    .all()
    .map((r) => r.note!)
    .filter(Boolean);
}

export function getGoals(): GoalItem[] {
  return getDb()
    .select()
    .from(g)
    .orderBy(g.id)
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      targetCents: row.targetCents,
      period: row.period === "month" || row.period === "year" ? (row.period as GoalPeriod) : null,
      startDate: row.startDate,
      endDate: row.endDate,
    }));
}

export function saveGoal(id: number | null, input: GoalInput): number {
  const db = getDb();
  const values = input.period ? { ...input, startDate: null, endDate: null } : input;
  if (id != null) {
    db.update(g).set(values).where(eq(g.id, id)).run();
    return id;
  }
  return db.insert(g).values(values).returning({ id: g.id }).get().id;
}

export function deleteGoal(id: number): void {
  getDb().delete(g).where(eq(g.id, id)).run();
}

/** Всё для денежного блока: суммы по периодам и цели с прогрессом. */
export function getMoneyOverview(today: string): {
  entries: MoneyEntryItem[];
  totals: PeriodTotals;
  goals: GoalWithProgress[];
} {
  const entries = getEntries();
  return {
    entries,
    totals: periodTotals(entries, today),
    goals: getGoals().map((goal) => ({ ...goal, progress: goalProgress(goal, entries, today) })),
  };
}
