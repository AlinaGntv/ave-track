"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addTimeEntry,
  clearTimeEntries,
  deleteTimeEntry,
  importTimeEntries,
  startTimer,
  stopTimer,
} from "./server";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(500);
const durationMs = z.number().int().positive().max(31_536_000_000);

function refresh() {
  revalidatePath("/time-tracker");
}

export async function startTimeTrackerAction(taskName: string): Promise<void> {
  startTimer(name.parse(taskName));
  refresh();
}

export async function stopTimeTrackerAction(): Promise<void> {
  stopTimer();
  refresh();
}

export async function addTimeEntryAction(input: { name: string; durationMs: number; date: number }): Promise<void> {
  const parsed = z.object({
    name,
    durationMs,
    date: z.number().int().positive().max(Date.now() + 86_400_000),
  }).parse(input);
  addTimeEntry(parsed);
  refresh();
}

export async function deleteTimeEntryAction(entryId: number): Promise<void> {
  deleteTimeEntry(id.parse(entryId));
  refresh();
}

export async function clearTimeEntriesAction(): Promise<void> {
  clearTimeEntries();
  refresh();
}

export async function importTimeEntriesAction(
  records: Array<{ id: string; name: string; durationMs: number; date: number }>,
): Promise<{ imported: number; skipped: number }> {
  const parsed = z.array(
    z.object({
      id: z.string().min(1).max(100),
      name,
      durationMs,
      date: z.number().int().positive().max(Date.now() + 86_400_000),
    }),
  ).max(5000).parse(records);
  const result = importTimeEntries(parsed);
  refresh();
  return result;
}
