import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, max, notInArray, type SQL } from "drizzle-orm";
import { getDb, schema, type Db } from "@/shared/db/client";
import type { Task } from "@/shared/db/schema";
import { parseRecurrence, serializeRecurrence } from "@/features/recurrence/rule";
import {
  applyCompletion,
  completionOutcome,
  type CompletionOutcome,
  type Priority,
  type SubtaskItem,
  type TaskDraft,
  type TaskItem,
} from "./model";

const t = schema.tasks;
const c = schema.taskCompletions;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type CompletionStats = { count: number; last: number | null };

function toItem(row: Task, subtasks: SubtaskItem[], stats?: CompletionStats): TaskItem {
  return {
    id: row.id,
    listId: row.listId,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    priority: row.priority as Priority,
    flagged: row.flagged,
    completedAt: row.completedAt?.getTime() ?? null,
    recurrence: parseRecurrence(row.recurrence),
    completionCount: stats?.count ?? 0,
    lastCompletedAt: stats?.last ?? null,
    sortOrder: row.sortOrder,
    subtasks,
  };
}

function withSubtasks(rows: Task[], db: Db | Tx = getDb()): TaskItem[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const stats = new Map<number, CompletionStats>(
    db
      .select({ taskId: c.taskId, n: count(), last: max(c.completedAt) })
      .from(c)
      .where(inArray(c.taskId, ids))
      .groupBy(c.taskId)
      .all()
      .map((r) => [r.taskId, { count: r.n, last: r.last?.getTime() ?? null }]),
  );
  const subs = db
    .select()
    .from(t)
    .where(inArray(t.parentId, ids))
    .orderBy(asc(t.sortOrder), asc(t.id))
    .all();
  const byParent = new Map<number, SubtaskItem[]>();
  for (const s of subs) {
    const list = byParent.get(s.parentId!) ?? [];
    list.push({ id: s.id, title: s.title, completedAt: s.completedAt?.getTime() ?? null });
    byParent.set(s.parentId!, list);
  }
  return rows.map((r) => toItem(r, byParent.get(r.id) ?? [], stats.get(r.id)));
}

/** Все невыполненные задачи верхнего уровня — основа для умных списков и счётчиков. */
export function getOpenTasks(): TaskItem[] {
  const rows = getDb()
    .select()
    .from(t)
    .where(and(isNull(t.parentId), isNull(t.completedAt)))
    .all();
  return withSubtasks(rows);
}

export function getCompletedTasks(opts: {
  listId?: number;
  dueFrom?: string;
  dueTo?: string;
  limit?: number;
} = {}): TaskItem[] {
  const where: SQL[] = [isNull(t.parentId), isNotNull(t.completedAt)];
  if (opts.listId != null) where.push(eq(t.listId, opts.listId));
  if (opts.dueFrom) where.push(gte(t.dueDate, opts.dueFrom));
  if (opts.dueTo) where.push(lte(t.dueDate, opts.dueTo));
  const rows = getDb()
    .select()
    .from(t)
    .where(and(...where))
    .orderBy(desc(t.completedAt))
    .limit(opts.limit ?? 300)
    .all();
  return withSubtasks(rows);
}

export function countCompleted(): number {
  return (
    getDb()
      .select({ n: count() })
      .from(t)
      .where(and(isNull(t.parentId), isNotNull(t.completedAt)))
      .get()?.n ?? 0
  );
}

function nextSortOrder(tx: Tx, listId: number): number {
  const row = tx
    .select({ m: max(t.sortOrder) })
    .from(t)
    .where(and(eq(t.listId, listId), isNull(t.parentId)))
    .get();
  return (row?.m ?? 0) + 1;
}

/** Создаёт (id = null) или обновляет задачу вместе с подзадачами в одной транзакции. Возвращает id. */
export function saveTask(id: number | null, draft: TaskDraft): number {
  return getDb().transaction((tx) => {
    const now = new Date();
    const values = {
      title: draft.title,
      notes: draft.notes || null,
      listId: draft.listId,
      dueDate: draft.dueDate,
      dueTime: draft.dueDate ? draft.dueTime : null,
      priority: draft.priority,
      flagged: draft.flagged,
      recurrence: draft.dueDate ? serializeRecurrence(draft.recurrence) : null,
      updatedAt: now,
    };

    let taskId: number;
    if (id == null) {
      taskId = tx
        .insert(t)
        .values({ ...values, sortOrder: nextSortOrder(tx, draft.listId) })
        .returning({ id: t.id })
        .get().id;
    } else {
      const existing = tx.select().from(t).where(and(eq(t.id, id), isNull(t.parentId))).get();
      if (!existing) throw new Error(`Задача ${id} не найдена`);
      const moved = existing.listId !== draft.listId;
      tx.update(t)
        .set({ ...values, ...(moved ? { sortOrder: nextSortOrder(tx, draft.listId) } : {}) })
        .where(eq(t.id, id))
        .run();
      taskId = id;
    }

    syncSubtasks(tx, taskId, draft, now);
    return taskId;
  });
}

function syncSubtasks(tx: Tx, parentId: number, draft: TaskDraft, now: Date) {
  const existing = new Map(
    tx.select().from(t).where(eq(t.parentId, parentId)).all().map((s) => [s.id, s]),
  );
  const keep = draft.subtasks.flatMap((s) => (s.id != null && existing.has(s.id) ? [s.id] : []));

  tx.delete(t)
    .where(and(eq(t.parentId, parentId), keep.length ? notInArray(t.id, keep) : undefined))
    .run();

  draft.subtasks.forEach((sub, index) => {
    const prev = sub.id != null ? existing.get(sub.id) : undefined;
    const values = {
      title: sub.title,
      listId: draft.listId,
      sortOrder: index,
      completedAt: sub.done ? (prev?.completedAt ?? now) : null,
      updatedAt: now,
    };
    if (prev) tx.update(t).set(values).where(eq(t.id, prev.id)).run();
    else tx.insert(t).values({ ...values, parentId }).run();
  });
}

export function deleteTask(id: number): void {
  // Подзадачи удалятся каскадом (foreign_keys = ON)
  getDb().delete(t).where(eq(t.id, id)).run();
}

/**
 * Отмечает задачу выполненной. Факт выполнения пишется в task_completions;
 * повторяющаяся задача переносится на следующую дату по правилу, пока серия не закончилась.
 * Используется и веб-приложением, и Telegram-ботом.
 */
export function completeTask(id: number, today: string): CompletionOutcome {
  return getDb().transaction((tx) => {
    const row = tx.select().from(t).where(and(eq(t.id, id), isNull(t.parentId))).get();
    if (!row) throw new Error(`Задача ${id} не найдена`);
    const [task] = withSubtasks([row], tx);
    if (task!.completedAt != null) return { type: "completed" } as const;

    const now = Date.now();
    const outcome = completionOutcome(task!, today);
    const next = applyCompletion(task!, outcome, now);

    tx.insert(c).values({ taskId: id, dueDate: row.dueDate, completedAt: new Date(now) }).run();
    tx.update(t)
      .set({
        dueDate: next.dueDate,
        completedAt: next.completedAt != null ? new Date(next.completedAt) : null,
        updatedAt: new Date(now),
      })
      .where(eq(t.id, id))
      .run();
    if (outcome.type === "rescheduled") {
      tx.update(t).set({ completedAt: null, updatedAt: new Date(now) }).where(eq(t.parentId, id)).run();
    }
    return outcome;
  });
}

/**
 * Отмена выполнения: снимает отметку и удаляет последнюю запись истории.
 * Для перенесённой повторяющейся задачи возвращает прежнюю дату (restoreDueDate).
 */
export function uncompleteTask(id: number, restoreDueDate: string | null): void {
  getDb().transaction((tx) => {
    const last = tx
      .select({ id: c.id })
      .from(c)
      .where(eq(c.taskId, id))
      .orderBy(desc(c.completedAt), desc(c.id))
      .limit(1)
      .get();
    if (last) tx.delete(c).where(eq(c.id, last.id)).run();
    tx.update(t)
      .set({
        completedAt: null,
        updatedAt: new Date(),
        ...(restoreDueDate ? { dueDate: restoreDueDate } : {}),
      })
      .where(eq(t.id, id))
      .run();
  });
}

/** Ручной порядок задач в списке: sortOrder = позиция в переданном массиве. */
export function reorderTasks(listId: number, ids: number[]): void {
  getDb().transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(t)
        .set({ sortOrder: index + 1 })
        .where(and(eq(t.id, id), eq(t.listId, listId), isNull(t.parentId)))
        .run();
    });
  });
}
