"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSportProfile,
  createSportWorkout,
  deleteSportExercise,
  deleteSportProfile,
  markSportActivity,
  saveSportExercise,
  saveSportMeasurement,
  updateSportProfile,
} from "./server";

const id = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable();
const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  activity: z.string().trim().min(1).max(80),
  heightCm: nullableNumber(80, 250),
  targetWeightKg: nullableNumber(20, 500),
  targetWaistCm: nullableNumber(20, 250),
  targetHipsCm: nullableNumber(20, 250),
  workoutIntervalDays: z.number().int().min(1).max(14),
});

function refresh() {
  revalidatePath("/sport");
}

export async function createSportProfileAction(input: z.input<typeof profileSchema>): Promise<number> {
  const id = createSportProfile(profileSchema.parse(input));
  refresh();
  return id;
}

export async function updateSportProfileAction(profileId: number, input: z.input<typeof profileSchema>): Promise<void> {
  updateSportProfile(id.parse(profileId), profileSchema.parse(input));
  refresh();
}

export async function deleteSportProfileAction(profileId: number): Promise<void> {
  deleteSportProfile(id.parse(profileId));
  refresh();
}

const exerciseSchema = z.object({
  id: id.nullable(),
  profileId: id,
  dayLabel: z.string().trim().min(1).max(30),
  title: z.string().trim().min(1).max(100),
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(1).max(1000),
  unit: z.enum(["повторов", "минут", "кругов"]),
  weightKg: nullableNumber(0, 1000),
  sortOrder: z.number().int().min(0).max(10000),
});

export async function saveSportExerciseAction(input: z.input<typeof exerciseSchema>): Promise<void> {
  saveSportExercise(exerciseSchema.parse(input));
  refresh();
}

export async function deleteSportExerciseAction(exerciseId: number): Promise<void> {
  deleteSportExercise(id.parse(exerciseId));
  refresh();
}

const workoutSchema = z.object({
  profileId: id,
  date,
  dayLabel: z.string().trim().min(1).max(30),
  note: z.string().max(1000),
  applyActualAsTarget: z.boolean(),
  exercises: z.array(z.object({
    exerciseId: id,
    title: z.string().trim().min(1).max(100),
    targetSets: z.number().int().min(1).max(100),
    targetReps: z.number().int().min(1).max(1000),
    targetUnit: z.enum(["повторов", "минут", "кругов"]),
    targetWeightKg: nullableNumber(0, 1000),
    actualReps: z.number().int().min(0).max(1000).nullable(),
    actualWeightKg: nullableNumber(0, 1000),
    completed: z.boolean(),
  })).max(100),
});

export async function createSportWorkoutAction(input: z.input<typeof workoutSchema>): Promise<number> {
  const workoutId = createSportWorkout(workoutSchema.parse(input));
  refresh();
  return workoutId;
}

export async function markSportActivityAction(profileId: number, activityDate: string, note = ""): Promise<void> {
  markSportActivity(id.parse(profileId), date.parse(activityDate), z.string().max(500).parse(note));
  refresh();
}

const measurementSchema = z.object({
  profileId: id,
  date,
  weightKg: nullableNumber(20, 500),
  chestCm: nullableNumber(20, 250),
  waistCm: nullableNumber(20, 250),
  hipsCm: nullableNumber(20, 250),
});

export async function saveSportMeasurementAction(input: z.input<typeof measurementSchema>): Promise<void> {
  saveSportMeasurement(measurementSchema.parse(input));
  refresh();
}
