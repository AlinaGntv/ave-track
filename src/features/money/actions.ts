"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_AMOUNT_CENTS } from "./model";
import { deleteEntry, deleteGoal, saveEntry, saveGoal, type EntryInput, type GoalInput } from "./server";

const id = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cents = z.number().int().positive().max(MAX_AMOUNT_CENTS);

const entrySchema = z.object({
  amountCents: cents,
  date,
  note: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((v) => v || null),
});

const goalSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    targetCents: cents,
    period: z.enum(["month", "year"]).nullable(),
    startDate: date.nullable(),
    endDate: date.nullable(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, "Дедлайн раньше начала");

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveEntryAction(entryId: number | null, input: EntryInput): Promise<number> {
  const result = saveEntry(id.nullable().parse(entryId), entrySchema.parse(input));
  refresh();
  return result;
}

export async function deleteEntryAction(entryId: number): Promise<void> {
  deleteEntry(id.parse(entryId));
  refresh();
}

export async function saveGoalAction(goalId: number | null, input: GoalInput): Promise<number> {
  const result = saveGoal(id.nullable().parse(goalId), goalSchema.parse(input));
  refresh();
  return result;
}

export async function deleteGoalAction(goalId: number): Promise<void> {
  deleteGoal(id.parse(goalId));
  refresh();
}
