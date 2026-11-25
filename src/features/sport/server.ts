import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";

export type SportExerciseUnit = "повторов" | "минут" | "кругов";
export type SportProfile = {
  id: number;
  name: string;
  activity: string;
  heightCm: number | null;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetHipsCm: number | null;
  workoutIntervalDays: number;
};
export type SportExercise = {
  id: number;
  profileId: number;
  dayLabel: string;
  title: string;
  sets: number;
  reps: number;
  unit: SportExerciseUnit;
  weightKg: number | null;
  sortOrder: number;
};
export type SportWorkoutExercise = {
  id: number;
  workoutId: number;
  exerciseId: number | null;
  title: string;
  targetSets: number;
  targetReps: number;
  targetUnit: SportExerciseUnit;
  targetWeightKg: number | null;
  actualReps: number | null;
  actualWeightKg: number | null;
  completed: boolean;
};
export type SportWorkout = {
  id: number;
  profileId: number;
  date: string;
  dayLabel: string;
  note: string | null;
  createdAt: number;
  exercises: SportWorkoutExercise[];
};
export type SportMeasurement = {
  id: number;
  profileId: number;
  date: string;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
};
export type SportActivity = { id: number; profileId: number; date: string; note: string | null };
export type SportNutritionGoal = { profileId: number; calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
export type SportFoodEntry = { id: number; profileId: number; date: string; name: string; calories: number; protein: number; carbs: number; fat: number };

export function getSportData() {
  const db = getDb();
  const profiles: SportProfile[] = db.select().from(schema.sportProfiles).orderBy(asc(schema.sportProfiles.id)).all();
  const exercises: SportExercise[] = db.select().from(schema.sportExercises)
    .orderBy(asc(schema.sportExercises.profileId), asc(schema.sportExercises.dayLabel), asc(schema.sportExercises.sortOrder), asc(schema.sportExercises.id)).all()
    .map((row) => ({ ...row, unit: row.unit as SportExerciseUnit }));
  const workoutRows = db.select().from(schema.sportWorkouts)
    .orderBy(desc(schema.sportWorkouts.date), desc(schema.sportWorkouts.id)).limit(200).all();
  const workoutExercises = db.select().from(schema.sportWorkoutExercises).all();
  const exercisesByWorkout = new Map<number, SportWorkoutExercise[]>();
  for (const row of workoutExercises) {
    const list = exercisesByWorkout.get(row.workoutId) ?? [];
    list.push({ ...row, targetUnit: row.targetUnit as SportExerciseUnit });
    exercisesByWorkout.set(row.workoutId, list);
  }
  const workouts: SportWorkout[] = workoutRows.map((row) => ({
    ...row,
    createdAt: row.createdAt.getTime(),
    exercises: exercisesByWorkout.get(row.id) ?? [],
  }));
  const measurements: SportMeasurement[] = db.select().from(schema.sportMeasurements)
    .orderBy(asc(schema.sportMeasurements.date), asc(schema.sportMeasurements.id)).all();
  const activities: SportActivity[] = db.select().from(schema.sportActivityDays).all();
  const nutritionGoals: SportNutritionGoal[] = db.select().from(schema.sportNutritionGoals).all();
  const foodEntries: SportFoodEntry[] = db.select().from(schema.sportFoodEntries)
    .orderBy(desc(schema.sportFoodEntries.date), desc(schema.sportFoodEntries.id)).limit(1000).all();
  return { profiles, exercises, workouts, measurements, activities, nutritionGoals, foodEntries };
}

export function createSportProfile(input: Omit<SportProfile, "id">): number {
  return getDb().insert(schema.sportProfiles).values(input).returning({ id: schema.sportProfiles.id }).get().id;
}

export function updateSportProfile(id: number, input: Omit<SportProfile, "id">): void {
  getDb().update(schema.sportProfiles).set(input).where(eq(schema.sportProfiles.id, id)).run();
}

export function deleteSportProfile(id: number): void {
  getDb().delete(schema.sportProfiles).where(eq(schema.sportProfiles.id, id)).run();
}

export function saveSportExercise(input: Omit<SportExercise, "id"> & { id: number | null }): void {
  const { id, ...values } = input;
  const table = schema.sportExercises;
  if (id == null) {
    const maxOrder = getDb().select({ value: sql<number>`coalesce(max(${table.sortOrder}), -1)` }).from(table)
      .where(and(eq(table.profileId, values.profileId), eq(table.dayLabel, values.dayLabel))).get()?.value ?? -1;
    getDb().insert(table).values({ ...values, sortOrder: maxOrder + 1 }).run();
  } else {
    getDb().update(table).set(values).where(eq(table.id, id)).run();
  }
}

export function deleteSportExercise(id: number): void {
  getDb().delete(schema.sportExercises).where(eq(schema.sportExercises.id, id)).run();
}

export function reorderSportExercises(profileId: number, dayLabel: string, exerciseIds: number[]): void {
  const db = getDb();
  db.transaction((tx) => {
    exerciseIds.forEach((exerciseId, sortOrder) => {
      tx.update(schema.sportExercises).set({ sortOrder })
        .where(and(eq(schema.sportExercises.id, exerciseId), eq(schema.sportExercises.profileId, profileId), eq(schema.sportExercises.dayLabel, dayLabel))).run();
    });
  });
}

export function createSportWorkout(input: {
  profileId: number;
  date: string;
  dayLabel: string;
  note: string;
  exercises: Array<{
    exerciseId: number;
    title: string;
    targetSets: number;
    targetReps: number;
    targetUnit: SportExerciseUnit;
    targetWeightKg: number | null;
    actualReps: number | null;
    actualWeightKg: number | null;
    completed: boolean;
  }>;
  applyActualAsTarget: boolean;
}): number {
  const db = getDb();
  return db.transaction((tx) => {
    const workoutId = tx.insert(schema.sportWorkouts).values({
      profileId: input.profileId,
      date: input.date,
      dayLabel: input.dayLabel,
      note: input.note || null,
    }).returning({ id: schema.sportWorkouts.id }).get().id;

    for (const exercise of input.exercises) {
      tx.insert(schema.sportWorkoutExercises).values({ workoutId, ...exercise }).run();
      if (input.applyActualAsTarget && exercise.completed) {
        tx.update(schema.sportExercises).set({
          ...(exercise.actualReps != null && exercise.actualReps > 0 ? { reps: exercise.actualReps } : {}),
          ...(exercise.actualWeightKg != null ? { weightKg: exercise.actualWeightKg } : {}),
        }).where(eq(schema.sportExercises.id, exercise.exerciseId)).run();
      }
    }

    tx.insert(schema.sportActivityDays)
      .values({ profileId: input.profileId, date: input.date })
      .onConflictDoNothing()
      .run();
    return workoutId;
  });
}

export function markSportActivity(profileId: number, date: string, note: string): void {
  const table = schema.sportActivityDays;
  getDb().insert(table).values({ profileId, date, note: note || null })
    .onConflictDoUpdate({ target: [table.profileId, table.date], set: { note: note || null } })
    .run();
}

export function saveSportMeasurement(input: Omit<SportMeasurement, "id">): void {
  const table = schema.sportMeasurements;
  getDb().insert(table).values(input)
    .onConflictDoUpdate({
      target: [table.profileId, table.date],
      set: { weightKg: input.weightKg, chestCm: input.chestCm, waistCm: input.waistCm, hipsCm: input.hipsCm },
    })
    .run();
}

export function saveSportNutritionGoal(input: SportNutritionGoal): void {
  const table = schema.sportNutritionGoals;
  getDb().insert(table).values(input).onConflictDoUpdate({
    target: table.profileId,
    set: { calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat },
  }).run();
}

export function createSportFoodEntry(input: Omit<SportFoodEntry, "id">): number {
  return getDb().insert(schema.sportFoodEntries).values(input).returning({ id: schema.sportFoodEntries.id }).get().id;
}

export function deleteSportFoodEntry(entryId: number): void {
  getDb().delete(schema.sportFoodEntries).where(eq(schema.sportFoodEntries.id, entryId)).run();
}
