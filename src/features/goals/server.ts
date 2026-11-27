import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";

export type PersonalGoal = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  targetCents: number | null;
  savedCents: number;
  completed: boolean;
};

export type PersonalGoalInput = Omit<PersonalGoal, "id">;
export type PersonalWish = { id: number; title: string; completed: boolean };

export function getPersonalGoals(): PersonalGoal[] {
  return getDb().select().from(schema.personalGoals)
    .orderBy(asc(schema.personalGoals.completed), asc(schema.personalGoals.deadline), asc(schema.personalGoals.id)).all();
}

export function savePersonalGoal(goalId: number | null, input: PersonalGoalInput): number {
  const table = schema.personalGoals;
  if (goalId == null) return getDb().insert(table).values(input).returning({ id: table.id }).get().id;
  getDb().update(table).set(input).where(eq(table.id, goalId)).run();
  return goalId;
}

export function setPersonalGoalCompleted(goalId: number, completed: boolean): void {
  getDb().update(schema.personalGoals).set({ completed }).where(eq(schema.personalGoals.id, goalId)).run();
}

export function deletePersonalGoal(goalId: number): void {
  getDb().delete(schema.personalGoals).where(eq(schema.personalGoals.id, goalId)).run();
}

export function getPersonalWishes(): PersonalWish[] {
  return getDb().select({ id: schema.personalWishes.id, title: schema.personalWishes.title, completed: schema.personalWishes.completed })
    .from(schema.personalWishes).orderBy(asc(schema.personalWishes.completed), asc(schema.personalWishes.id)).all();
}

export function addPersonalWish(title: string): number {
  return getDb().insert(schema.personalWishes).values({ title }).returning({ id: schema.personalWishes.id }).get().id;
}

export function setPersonalWishCompleted(wishId: number, completed: boolean): void {
  getDb().update(schema.personalWishes).set({ completed }).where(eq(schema.personalWishes.id, wishId)).run();
}

export function deletePersonalWish(wishId: number): void {
  getDb().delete(schema.personalWishes).where(eq(schema.personalWishes.id, wishId)).run();
}
