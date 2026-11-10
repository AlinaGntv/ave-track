"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recurrenceSchema } from "@/features/recurrence/rule";
import { getSettings, setSetting } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";
import { MAX_EARLY_REMINDERS, type EarlyOffset } from "./early";
import { cleanDraft, SORT_MODES, type CompletionOutcome, type SortMode, type TaskDraft } from "./model";
import { completeTask, deleteTask, reorderTasks, saveTask, uncompleteTask } from "./server";

const id = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const draftSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000),
  listId: id,
  dueDate: date.nullable(),
  dueTime: time.nullable(),
  durationMinutes: z.number().int().min(5).max(1440).nullable(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  flagged: z.boolean(),
  recurrence: recurrenceSchema.nullable(),
  earlyReminders: z
    .array(z.string().regex(/^[1-9]\d{0,2}[dwm]$/) as z.ZodType<EarlyOffset>)
    .max(MAX_EARLY_REMINDERS),
  subtasks: z
    .array(z.object({ id: id.optional(), title: z.string().trim().min(1).max(500), done: z.boolean() }))
    .max(100),
});

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveTaskAction(taskId: number | null, draft: TaskDraft): Promise<number> {
  const parsed = draftSchema.parse(cleanDraft(draft));
  const result = saveTask(id.nullable().parse(taskId), parsed);
  refresh();
  return result;
}

export async function deleteTaskAction(taskId: number): Promise<void> {
  deleteTask(id.parse(taskId));
  refresh();
}

export async function completeTaskAction(taskId: number): Promise<CompletionOutcome> {
  const outcome = completeTask(id.parse(taskId), todayIn(getSettings().timezone));
  refresh();
  return outcome;
}

export async function uncompleteTaskAction(taskId: number, restoreDueDate: string | null): Promise<void> {
  uncompleteTask(id.parse(taskId), date.nullable().parse(restoreDueDate));
  refresh();
}

export async function reorderTasksAction(listId: number, ids: number[]): Promise<void> {
  reorderTasks(id.parse(listId), z.array(id).max(5000).parse(ids));
  refresh();
}

const sortKeySchema = z.string().regex(/^(list:\d+|smart:(all|flagged))$/);

/** Запомнить сортировку экрана (в настройках — одинаково на телефоне и компьютере). */
export async function setListSortAction(key: string, mode: SortMode): Promise<void> {
  const current = getSettings().listSort;
  setSetting("listSort", {
    ...current,
    [sortKeySchema.parse(key)]: z.enum(SORT_MODES).parse(mode),
  });
  refresh();
}
