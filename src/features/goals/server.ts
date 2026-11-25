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
