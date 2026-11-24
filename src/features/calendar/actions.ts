"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { splitTaskCalendarBlock, updateCalendarChain, updateTaskCalendarSegment } from "@/features/tasks/server";

const minute = z.number().int().min(0).max(1440);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function splitTaskCalendarBlockAction(input: {
  taskId: number;
  date: string;
  segmentId: number | null;
  start: number;
  end: number;
  splitAt: number;
}): Promise<void> {
  const parsed = z.object({
    taskId: z.number().int().positive(),
    date: day,
    segmentId: z.number().int().positive().nullable(),
    start: minute,
    end: minute,
    splitAt: minute,
  }).parse(input);
  if (
    parsed.end <= parsed.start ||
    parsed.end > 1440 ||
    parsed.splitAt - parsed.start < 5 ||
    parsed.end - parsed.splitAt < 5
  ) {
    throw new Error("Каждая часть должна длиться не менее 5 минут.");
  }
  splitTaskCalendarBlock(parsed);
  revalidatePath("/", "layout");
}

export async function updateTaskCalendarSegmentAction(input: {
  segmentId: number;
  start: number;
  durationMinutes: number;
}): Promise<void> {
  const parsed = z.object({
    segmentId: z.number().int().positive(),
    start: minute,
    durationMinutes: z.number().int().min(5).max(1440),
  }).parse(input);
  if (parsed.start + parsed.durationMinutes > 1440) throw new Error("Отрезок не помещается в этот день.");
  updateTaskCalendarSegment(parsed.segmentId, parsed.start, parsed.durationMinutes);
  revalidatePath("/", "layout");
}

export async function updateCalendarChainAction(input: Array<{
  taskId: number;
  segmentId: number | null;
  date: string;
  expectedStart: number;
  expectedDurationMinutes: number;
  start: number;
  durationMinutes: number;
  instanceOnly: boolean;
}>): Promise<void> {
  const parsed = z.array(z.object({
    taskId: z.number().int().positive(),
    segmentId: z.number().int().positive().nullable(),
    date: day,
    expectedStart: z.number().int().min(0).max(1439),
    expectedDurationMinutes: z.number().int().min(5).max(1440),
    start: z.number().int().min(0).max(1439),
    durationMinutes: z.number().int().min(5).max(1440),
    instanceOnly: z.boolean(),
  }).refine((row) => row.start + row.durationMinutes <= 1440, "Задача не помещается в этот день."))
    .min(1).max(100).parse(input);
  if (new Set(parsed.map((row) => `${row.segmentId ?? "task"}:${row.segmentId ?? row.taskId}`)).size !== parsed.length) {
    throw new Error("В цепочке повторяется задача.");
  }
  updateCalendarChain(parsed);
  revalidatePath("/", "layout");
}
