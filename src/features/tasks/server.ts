import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, max, notInArray, type SQL } from "drizzle-orm";
import { getDb, schema, type Db } from "@/shared/db/client";
import type { Task } from "@/shared/db/schema";
import { parseRecurrence, serializeRecurrence } from "@/features/recurrence/rule";
import { parseEarlyJson, serializeEarly } from "./early";
import {
  DEFAULT_DURATION,
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
    durationMinutes: row.durationMinutes,
    priority: row.priority as Priority,
    flagged: row.flagged,
    completedAt: row.completedAt?.getTime() ?? null,
    recurrence: parseRecurrence(row.recurrence),
    earlyReminders: parseEarlyJson(row.earlyReminders),
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

/** Завершённые вхождения повторяющихся задач, чья серия всё ещё активна. */
export function getCompletedRecurringOccurrences(
  dueFrom: string,
  dueTo: string,
): Array<TaskItem & { completionId: number }> {
  const rows = getDb()
    .select({ id: c.id, taskId: c.taskId, dueDate: c.dueDate, dueTime: c.dueTime, durationMinutes: c.durationMinutes, completedAt: c.completedAt })
    .from(c)
    .innerJoin(t, eq(c.taskId, t.id))
    .where(
      and(
        isNull(t.completedAt),
        isNotNull(t.recurrence),
        isNotNull(c.dueDate),
        gte(c.dueDate, dueFrom),
        lte(c.dueDate, dueTo),
      ),
    )
    .all();
  if (rows.length === 0) return [];

  const tasks = new Map(withSubtasks(
    getDb()
      .select()
      .from(t)
      .where(inArray(t.id, [...new Set(rows.map((r) => r.taskId))]))
      .all(),
  ).map((task) => [task.id, task]));

  return rows.flatMap((row) => {
    const task = tasks.get(row.taskId);
    if (!task || !row.dueDate) return [];
    return [{
      ...task,
      dueDate: row.dueDate,
      dueTime: row.dueTime ?? task.dueTime,
      durationMinutes: row.durationMinutes ?? task.durationMinutes,
      completedAt: row.completedAt.getTime(),
      completionId: row.id,
    }];
  });
}

/** Изменить время или длительность конкретного выполненного вхождения, не затрагивая серию. */
export function updateCompletedOccurrence(
  completionId: number,
  values: { dueDate: string; dueTime: string; durationMinutes: number },
): void {
  getDb()
    .update(c)
    .set(values)
    .where(eq(c.id, completionId))
    .run();
}

export type TaskCalendarSegment = { id: number; taskId: number; date: string; startTime: string; durationMinutes: number };

export function getTaskCalendarSegments(from: string, to: string): TaskCalendarSegment[] {
  return getDb()
    .select({ id: schema.taskCalendarSegments.id, taskId: schema.taskCalendarSegments.taskId, date: schema.taskCalendarSegments.date, startTime: schema.taskCalendarSegments.startTime, durationMinutes: schema.taskCalendarSegments.durationMinutes })
    .from(schema.taskCalendarSegments)
    .where(and(gte(schema.taskCalendarSegments.date, from), lte(schema.taskCalendarSegments.date, to)))
    .all();
}

/** Календарное расписание экземпляра, если оно переопределено на конкретный день. */
export function applyTaskCalendarSchedule(task: TaskItem, date: string): TaskItem {
  const segment = getDb()
    .select({ startTime: schema.taskCalendarSegments.startTime, durationMinutes: schema.taskCalendarSegments.durationMinutes })
    .from(schema.taskCalendarSegments)
    .where(and(
      eq(schema.taskCalendarSegments.taskId, task.id),
      eq(schema.taskCalendarSegments.date, date),
    ))
    .orderBy(asc(schema.taskCalendarSegments.startTime), asc(schema.taskCalendarSegments.id))
    .get();
  return segment ? { ...task, dueTime: segment.startTime, durationMinutes: segment.durationMinutes } : task;
}

export function splitTaskCalendarBlock(input: {
  taskId: number;
  date: string;
  segmentId: number | null;
  start: number;
  end: number;
  splitAt: number;
}): void {
  const segments = schema.taskCalendarSegments;
  const startTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  getDb().transaction((tx) => {
    if (input.segmentId != null) {
      const current = tx.select().from(segments).where(and(
        eq(segments.id, input.segmentId),
        eq(segments.taskId, input.taskId),
        eq(segments.date, input.date),
      )).get();
      if (!current || current.startTime !== startTime(input.start) || current.durationMinutes !== input.end - input.start) {
        throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
      }
      tx.delete(segments).where(eq(segments.id, current.id)).run();
    } else {
      const existing = tx.select({ id: segments.id }).from(segments).where(and(
        eq(segments.taskId, input.taskId),
        eq(segments.date, input.date),
      )).get();
      if (existing) throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
    }
    tx.insert(segments).values([
      { taskId: input.taskId, date: input.date, startTime: startTime(input.start), durationMinutes: input.splitAt - input.start },
      { taskId: input.taskId, date: input.date, startTime: startTime(input.splitAt), durationMinutes: input.end - input.splitAt },
    ]).run();
  });
}

export function updateTaskCalendarSegment(segmentId: number, start: number, durationMinutes: number): void {
  const startTime = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  getDb()
    .update(schema.taskCalendarSegments)
    .set({ startTime, durationMinutes })
    .where(eq(schema.taskCalendarSegments.id, segmentId))
    .run();
}

/** Переносит весь календарный экземпляр задачи с отрезками на другую дату. */
export function moveTaskCalendarOccurrence(input: {
  segmentId: number;
  targetDate: string;
  start: number;
  durationMinutes: number;
}): void {
  const segments = schema.taskCalendarSegments;
  const startTime = `${String(Math.floor(input.start / 60)).padStart(2, "0")}:${String(input.start % 60).padStart(2, "0")}`;
  getDb().transaction((tx) => {
    const segment = tx.select().from(segments).where(eq(segments.id, input.segmentId)).get();
    if (!segment) throw new Error("Отрезок не найден. Обнови календарь и попробуй ещё раз.");
    const task = tx.select().from(t).where(and(eq(t.id, segment.taskId), isNull(t.parentId))).get();
    if (!task || task.completedAt || task.dueDate !== segment.date) {
      throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
    }

    // Все части одной задачи в этот день переносятся вместе, чтобы она не осталась
    // одновременно в исходном и целевом дне. Остальные повторы сохраняют своё время.
    tx.update(segments).set({ date: input.targetDate })
      .where(and(eq(segments.taskId, segment.taskId), eq(segments.date, segment.date))).run();
    tx.update(segments).set({ startTime, durationMinutes: input.durationMinutes })
      .where(eq(segments.id, input.segmentId)).run();
    tx.update(t).set({ dueDate: input.targetDate, updatedAt: new Date() })
      .where(eq(t.id, segment.taskId)).run();
  });
}

/** Сохраняет время одного экземпляра задачи в календаре, не меняя расписание серии. */
export function saveTaskCalendarOccurrence(input: {
  taskId: number;
  segmentId: number | null;
  date: string;
  start: number;
  durationMinutes: number;
}): void {
  const segments = schema.taskCalendarSegments;
  const startTime = `${String(Math.floor(input.start / 60)).padStart(2, "0")}:${String(input.start % 60).padStart(2, "0")}`;
  getDb().transaction((tx) => {
    const task = tx.select().from(t).where(and(eq(t.id, input.taskId), isNull(t.parentId))).get();
    if (!task || task.completedAt) throw new Error("Задача больше недоступна для изменения.");

    if (input.segmentId != null) {
      const segment = tx.select().from(segments).where(eq(segments.id, input.segmentId)).get();
      if (!segment || segment.taskId !== input.taskId || segment.date !== input.date) {
        throw new Error("Отрезок изменился. Обнови календарь и попробуй ещё раз.");
      }
      tx.update(segments).set({ startTime, durationMinutes: input.durationMinutes })
        .where(eq(segments.id, input.segmentId)).run();
      return;
    }

    const existing = tx.select({ id: segments.id }).from(segments).where(and(
      eq(segments.taskId, input.taskId), eq(segments.date, input.date),
    )).get();
    if (existing) throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
    tx.insert(segments).values({
      taskId: input.taskId,
      date: input.date,
      startTime,
      durationMinutes: input.durationMinutes,
    }).run();
  });
}

/** Перенос блока календаря и сдвиг цепочки задач — атомарно, только если расписание не изменилось. */
export function updateCalendarChain(updates: Array<{
  taskId: number;
  segmentId: number | null;
  date: string;
  expectedStart: number;
  expectedDurationMinutes: number;
  start: number;
  durationMinutes: number;
  instanceOnly: boolean;
}>): void {
  const segments = schema.taskCalendarSegments;
  const formatTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  getDb().transaction((tx) => {
    for (const update of updates) {
      if (update.segmentId != null) {
        const segment = tx.select().from(segments).where(eq(segments.id, update.segmentId)).get();
        if (!segment || segment.taskId !== update.taskId || segment.date !== update.date ||
            segment.startTime !== formatTime(update.expectedStart) || segment.durationMinutes !== update.expectedDurationMinutes) {
          throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
        }
        const task = tx.select().from(t).where(eq(t.id, update.taskId)).get();
        if (!task || task.completedAt) throw new Error("Эту задачу нельзя сдвинуть вместе с цепочкой.");
      } else {
        const task = tx.select().from(t).where(and(eq(t.id, update.taskId), isNull(t.parentId))).get();
        const existingSegment = tx.select({ id: segments.id }).from(segments).where(and(
          eq(segments.taskId, update.taskId), eq(segments.date, update.date),
        )).get();
        if (!task || task.completedAt || (update.instanceOnly ? !task.recurrence : !!task.recurrence) || existingSegment || task.dueDate !== update.date ||
            task.dueTime !== formatTime(update.expectedStart) || (task.durationMinutes ?? DEFAULT_DURATION) !== update.expectedDurationMinutes) {
          throw new Error("Расписание изменилось. Обнови календарь и попробуй ещё раз.");
        }
      }
    }

    for (const update of updates) {
      if (update.segmentId != null) {
        tx.update(segments).set({ startTime: formatTime(update.start), durationMinutes: update.durationMinutes })
          .where(eq(segments.id, update.segmentId)).run();
      } else if (update.instanceOnly) {
        tx.insert(segments).values({
          taskId: update.taskId,
          date: update.date,
          startTime: formatTime(update.start),
          durationMinutes: update.durationMinutes,
        }).run();
      } else {
        tx.update(t).set({ dueTime: formatTime(update.start), durationMinutes: update.durationMinutes, updatedAt: new Date() })
          .where(eq(t.id, update.taskId)).run();
      }
    }
  });
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
      durationMinutes: draft.dueDate && draft.dueTime ? draft.durationMinutes : null,
      priority: draft.priority,
      flagged: draft.flagged,
      recurrence: draft.dueDate ? serializeRecurrence(draft.recurrence) : null,
      earlyReminders: draft.dueDate ? serializeEarly(draft.earlyReminders) : null,
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
    const calendarOverride = row.dueDate
      ? tx.select({ startTime: schema.taskCalendarSegments.startTime, durationMinutes: schema.taskCalendarSegments.durationMinutes })
          .from(schema.taskCalendarSegments)
          .where(and(eq(schema.taskCalendarSegments.taskId, id), eq(schema.taskCalendarSegments.date, row.dueDate)))
          .orderBy(asc(schema.taskCalendarSegments.startTime), asc(schema.taskCalendarSegments.id))
          .get()
      : undefined;

    tx.insert(c)
      .values({
        taskId: id,
        dueDate: row.dueDate,
        dueTime: calendarOverride?.startTime ?? row.dueTime,
        durationMinutes: calendarOverride?.durationMinutes ?? row.durationMinutes,
        completedAt: new Date(now),
      })
      .run();
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
