"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addPersonalWish, deletePersonalGoal, deletePersonalWish, savePersonalGoal, setPersonalGoalCompleted, setPersonalWishCompleted } from "./server";

const id = z.number().int().positive();
const goalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  category: z.enum(["personal", "purchase", "health", "career", "other"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  targetCents: z.number().int().positive().max(100_000_000_00).nullable(),
  savedCents: z.number().int().min(0).max(100_000_000_00),
  completed: z.boolean(),
}).refine((goal) => goal.category !== "purchase" || goal.targetCents != null, "Укажи стоимость покупки");

export async function savePersonalGoalAction(goalId: number | null, input: z.input<typeof goalSchema>): Promise<number> {
  const result = savePersonalGoal(goalId == null ? null : id.parse(goalId), goalSchema.parse(input));
  revalidatePath("/goals");
  return result;
}

export async function setPersonalGoalCompletedAction(goalId: number, completed: boolean): Promise<void> {
  setPersonalGoalCompleted(id.parse(goalId), z.boolean().parse(completed));
  revalidatePath("/goals");
}

export async function deletePersonalGoalAction(goalId: number): Promise<void> {
  deletePersonalGoal(id.parse(goalId));
  revalidatePath("/goals");
}

export async function addPersonalWishAction(title: string): Promise<number> {
  const wishId = addPersonalWish(z.string().trim().min(1).max(180).parse(title));
  revalidatePath("/goals");
  return wishId;
}

export async function setPersonalWishCompletedAction(wishId: number, completed: boolean): Promise<void> {
  setPersonalWishCompleted(id.parse(wishId), z.boolean().parse(completed));
  revalidatePath("/goals");
}

export async function deletePersonalWishAction(wishId: number): Promise<void> {
  deletePersonalWish(id.parse(wishId));
  revalidatePath("/goals");
}
