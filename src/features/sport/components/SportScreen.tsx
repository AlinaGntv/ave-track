"use client";

import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Dumbbell, Footprints, Flame, Pencil, Plus, Ruler, Target, Trash2, Weight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { formatDate } from "@/shared/lib/dates";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";
import { useToast } from "@/shared/ui/Toast";
import {
  createSportProfileAction,
  createSportFoodEntryAction,
  createSportWorkoutAction,
  deleteSportExerciseAction,
  deleteSportFoodEntryAction,
  deleteSportProfileAction,
  markSportActivityAction,
  saveSportExerciseAction,
  saveSportMeasurementAction,
  saveSportNutritionGoalAction,
  reorderSportExercisesAction,
  updateSportProfileAction,
} from "../actions";
import type { SportActivity, SportExercise, SportExerciseUnit, SportFoodEntry, SportMeasurement, SportNutritionGoal, SportProfile, SportWorkout } from "../server";

type Tab = "Обзор" | "Программа" | "Питание" | "Мои данные";
type SportData = {
  profiles: SportProfile[];
  exercises: SportExercise[];
  workouts: SportWorkout[];
  measurements: SportMeasurement[];
  activities: SportActivity[];
  nutritionGoals: SportNutritionGoal[];
  foodEntries: SportFoodEntry[];
};

function shiftDay(date: string, amount: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
function numberOrNull(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}
function formatWeight(value: number | null | undefined): string {
  return value == null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)} кг`;
}
function streakLength(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  if (!dates.has(cursor)) return 0;
  let count = 0;
  while (dates.has(cursor)) {
    count++;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}
function workoutStreak(dates: string[], today: string, interval: number): number {
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  if (!sorted.length || (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${sorted[0]}T12:00:00Z`).getTime()) / 86_400_000 > interval) return 0;
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(`${sorted[i - 1]}T12:00:00Z`).getTime() - new Date(`${sorted[i]}T12:00:00Z`).getTime()) / 86_400_000;
    if (gap > interval) break;
    count++;
  }
  return count;
}

export function SportScreen({ data, today }: { data: SportData; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [profileId, setProfileId] = useState<number | null>(data.profiles[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("Обзор");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileActivity, setProfileActivity] = useState("");
  const [dayLabel, setDayLabel] = useState("A");
  const [exerciseEditor, setExerciseEditor] = useState<SportExercise | null | false>(false);
  const [exerciseEditorDay, setExerciseEditorDay] = useState("A");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("3");
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exerciseUnit, setExerciseUnit] = useState<SportExerciseUnit>("повторов");
  const [exerciseWeight, setExerciseWeight] = useState("");
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [workoutLog, setWorkoutLog] = useState<Record<number, { completed: boolean; reps: string; weight: string }>>({});
  const [workoutNote, setWorkoutNote] = useState("");
  const [applyActual, setApplyActual] = useState(false);
  const [bodyFocus, setBodyFocus] = useState<"chest" | "waist" | "hips">("waist");
  const [weightValue, setWeightValue] = useState("");
  const [chestValue, setChestValue] = useState("");
  const [waistValue, setWaistValue] = useState("");
  const [hipsValue, setHipsValue] = useState("");
  const [profileHeight, setProfileHeight] = useState("");
  const [profileTargetWeight, setProfileTargetWeight] = useState("");
  const [profileTargetWaist, setProfileTargetWaist] = useState("");
  const [profileTargetHips, setProfileTargetHips] = useState("");
  const [profileInterval, setProfileInterval] = useState("2");
  const [profileActivityEdit, setProfileActivityEdit] = useState("");
  const [profileNameEdit, setProfileNameEdit] = useState("");
  const [nutritionDate, setNutritionDate] = useState(today);
  const [foodName, setFoodName] = useState("");
  const [foodCalories, setFoodCalories] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCarbs, setFoodCarbs] = useState("");
  const [foodFat, setFoodFat] = useState("");
  const nutritionGoal = data.nutritionGoals.find((item) => item.profileId === profile?.id);
  const [goalCalories, setGoalCalories] = useState("");
  const [goalProtein, setGoalProtein] = useState("");
  const [goalCarbs, setGoalCarbs] = useState("");
  const [goalFat, setGoalFat] = useState("");

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0] ?? null;
  const profileExercises = useMemo(() => data.exercises.filter((item) => item.profileId === profile?.id), [data.exercises, profile?.id]);
  const dayOptions = useMemo(() => [...new Set(profileExercises.map((item) => item.dayLabel))].sort((a, b) => a.localeCompare(b, "ru", { numeric: true })), [profileExercises]);
  const selectedDay = dayOptions.includes(dayLabel) ? dayLabel : dayOptions[0] ?? dayLabel;
  const plan = profileExercises.filter((item) => item.dayLabel === selectedDay).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const dayFoodEntries = data.foodEntries.filter((item) => item.profileId === profile?.id && item.date === nutritionDate);
  const consumed = dayFoodEntries.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const workouts = data.workouts.filter((item) => item.profileId === profile?.id);
  const measurements = data.measurements.filter((item) => item.profileId === profile?.id);
  const activities = data.activities.filter((item) => item.profileId === profile?.id);
  const activityDays = new Set([...activities.map((item) => item.date), ...workouts.map((item) => item.date)]);
  const workoutDates = [...new Set(workouts.map((item) => item.date))];
  const activityStreak = streakLength(activityDays, today);
  const trainingStreak = profile ? workoutStreak(workoutDates, today, profile.workoutIntervalDays) : 0;
  const weeklyStart = shiftDay(today, -6);
  const weeklyWorkouts = workoutDates.filter((date) => date >= weeklyStart && date <= today).length;
  const weeklyTarget = profile ? Math.ceil(7 / profile.workoutIntervalDays) : 0;
  const latest = measurements.at(-1);
  const todayActivity = activityDays.has(today);
  const bodyGoals = [
    { label: "Вес", current: latest?.weightKg, target: profile?.targetWeightKg, unit: "кг" },
    { label: "Талия", current: latest?.waistCm, target: profile?.targetWaistCm, unit: "см" },
    { label: "Бёдра", current: latest?.hipsCm, target: profile?.targetHipsCm, unit: "см" },
  ].filter((goal): goal is { label: string; current: number; target: number; unit: string } => goal.current != null && goal.target != null);

  useEffect(() => {
    if (profile && !dayOptions.includes(dayLabel)) setDayLabel(dayOptions[0] ?? "A");
  }, [profile?.id, dayOptions, dayLabel, profile]);
  useEffect(() => {
    setProfileNameEdit(profile?.name ?? "");
    setProfileActivityEdit(profile?.activity ?? "");
    setProfileHeight(profile?.heightCm?.toString() ?? "");
    setProfileTargetWeight(profile?.targetWeightKg?.toString() ?? "");
    setProfileTargetWaist(profile?.targetWaistCm?.toString() ?? "");
    setProfileTargetHips(profile?.targetHipsCm?.toString() ?? "");
    setProfileInterval(profile?.workoutIntervalDays.toString() ?? "2");
    setGoalCalories(nutritionGoal?.calories?.toString() ?? "");
    setGoalProtein(nutritionGoal?.protein?.toString() ?? "");
    setGoalCarbs(nutritionGoal?.carbs?.toString() ?? "");
    setGoalFat(nutritionGoal?.fat?.toString() ?? "");
    setWeightValue(latest?.weightKg?.toString() ?? "");
    setChestValue(latest?.chestCm?.toString() ?? "");
    setWaistValue(latest?.waistCm?.toString() ?? "");
    setHipsValue(latest?.hipsCm?.toString() ?? "");
  }, [profile?.id, latest?.id, nutritionGoal?.calories, nutritionGoal?.protein, nutritionGoal?.carbs, nutritionGoal?.fat]);

  const run = async (work: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await work();
      router.refresh();
      if (success) toast.show({ message: success });
      return true;
    } catch (error) {
      console.error(error);
      toast.show({ message: error instanceof Error ? error.message : "Не удалось сохранить изменения" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = profileName.trim();
    const activity = profileActivity.trim();
    if (!name || !activity) return;
    setBusy(true);
    try {
      const newId = await createSportProfileAction({ name, activity, heightCm: null, targetWeightKg: null, targetWaistCm: null, targetHipsCm: null, workoutIntervalDays: 2 });
      setProfileId(newId);
      setShowProfileForm(false);
      setProfileName("");
      setProfileActivity("");
      router.refresh();
      toast.show({ message: "Профиль создан" });
    } catch (error) {
      console.error(error);
      toast.show({ message: "Не удалось создать профиль" });
    } finally {
      setBusy(false);
    }
  };

  const openExerciseEditor = (exercise?: SportExercise, day = selectedDay) => {
    setExerciseEditor(exercise ?? null);
    setExerciseEditorDay(exercise?.dayLabel ?? day);
    setExerciseName(exercise?.title ?? "");
    setExerciseSets(String(exercise?.sets ?? 3));
    setExerciseReps(String(exercise?.reps ?? 10));
    setExerciseUnit(exercise?.unit ?? "повторов");
    setExerciseWeight(exercise?.weightKg?.toString() ?? "");
  };

  const saveExercise = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !exerciseName.trim()) return;
    const exercise = typeof exerciseEditor === "object" ? exerciseEditor : null;
    void run(() => saveSportExerciseAction({
      id: exercise?.id ?? null,
      profileId: profile.id,
      dayLabel: exerciseEditorDay,
      title: exerciseName.trim(),
      sets: Number(exerciseSets),
      reps: Number(exerciseReps),
      unit: exerciseUnit,
      weightKg: numberOrNull(exerciseWeight),
      sortOrder: exercise?.sortOrder ?? plan.length,
    }), exercise ? "Упражнение обновлено" : "Упражнение добавлено").then((ok) => { if (ok) setExerciseEditor(false); });
  };

  const startWorkout = () => {
    setWorkoutLog(Object.fromEntries(plan.map((exercise) => [exercise.id, {
      completed: false,
      reps: String(exercise.reps),
      weight: exercise.weightKg?.toString() ?? "",
    }])));
    setWorkoutNote("");
    setApplyActual(false);
    setWorkoutOpen(true);
  };

  const saveWorkout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    void run(() => createSportWorkoutAction({
      profileId: profile.id,
      date: today,
      dayLabel: selectedDay,
      note: workoutNote,
      applyActualAsTarget: applyActual,
      exercises: plan.map((exercise) => ({
        exerciseId: exercise.id,
        title: exercise.title,
        targetSets: exercise.sets,
        targetReps: exercise.reps,
        targetUnit: exercise.unit,
        targetWeightKg: exercise.weightKg,
        actualReps: numberOrNull(workoutLog[exercise.id]?.reps ?? ""),
        actualWeightKg: numberOrNull(workoutLog[exercise.id]?.weight ?? ""),
        completed: workoutLog[exercise.id]?.completed ?? false,
      })),
    }), "Тренировка сохранена").then((ok) => { if (ok) setWorkoutOpen(false); });
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    void run(() => updateSportProfileAction(profile.id, {
      name: profileNameEdit.trim(),
      activity: profileActivityEdit.trim(),
      heightCm: numberOrNull(profileHeight),
      targetWeightKg: numberOrNull(profileTargetWeight),
      targetWaistCm: numberOrNull(profileTargetWaist),
      targetHipsCm: numberOrNull(profileTargetHips),
      workoutIntervalDays: Number(profileInterval),
    }), "Данные профиля сохранены");
  };

  const saveMeasurement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    void run(() => saveSportMeasurementAction({
      profileId: profile.id,
      date: today,
      weightKg: numberOrNull(weightValue),
      chestCm: numberOrNull(chestValue),
      waistCm: numberOrNull(waistValue),
      hipsCm: numberOrNull(hipsValue),
    }), "Замеры за сегодня сохранены");
  };

  const saveNutritionGoals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    void run(() => saveSportNutritionGoalAction({
      profileId: profile.id,
      calories: numberOrNull(goalCalories) == null ? null : Math.round(Number(goalCalories)),
      protein: numberOrNull(goalProtein), carbs: numberOrNull(goalCarbs), fat: numberOrNull(goalFat),
    }), "Цели КБЖУ сохранены");
  };

  const addFoodEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !foodName.trim()) return;
    void run(() => createSportFoodEntryAction({
      profileId: profile.id, date: nutritionDate, name: foodName.trim(),
      calories: Math.round(Number(foodCalories) || 0), protein: Number(foodProtein) || 0,
      carbs: Number(foodCarbs) || 0, fat: Number(foodFat) || 0,
    }), "Запись питания добавлена").then((ok) => {
      if (ok) { setFoodName(""); setFoodCalories(""); setFoodProtein(""); setFoodCarbs(""); setFoodFat(""); }
    });
  };

  const moveExercise = (index: number, offset: number) => {
    if (!profile) return;
    const ids = plan.map((exercise) => exercise.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run(() => reorderSportExercisesAction(profile.id, selectedDay, ids), "Порядок обновлён");
  };

  const markActivity = () => {
    if (!profile || todayActivity) return;
    void run(() => markSportActivityAction(profile.id, today, "Самостоятельная активность"), "День отмечен как активный");
  };

  const addDay = () => {
    const next = String.fromCharCode(Math.max(64, ...dayOptions.map((d) => d.charCodeAt(0))) + 1);
    setDayLabel(next);
    openExerciseEditor(undefined, next);
  };

  const title = profile ? `${profile.name}` : "Твоя спортивная система";

  return (
    <>
      <ScreenHeader
        caption="Тело и движение"
        title="Спорт"
        right={<Pressable onClick={() => setShowProfileForm((value) => !value)} aria-label="Добавить профиль" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"><Plus size={20} /></Pressable>}
      />

      <div className="mx-4 space-y-4">
        {data.profiles.length > 0 && (
          <div className="rounded-[24px] bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg"><Dumbbell size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Активный профиль</p>
                <div className="relative mt-0.5">
                  <select value={profile?.id ?? ""} onChange={(event) => setProfileId(Number(event.target.value))} className="w-full appearance-none bg-transparent pr-6 text-base font-bold outline-none">
                    {data.profiles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.activity}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted-2" />
                </div>
              </div>
            </div>
          </div>
        )}

        {showProfileForm && (
          <form onSubmit={createProfile} className="rounded-[24px] bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Новый профиль</h2>
              <button type="button" onClick={() => setShowProfileForm(false)} aria-label="Закрыть"><X size={18} /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Название: Зал" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-sm" />
              <input required value={profileActivity} onChange={(event) => setProfileActivity(event.target.value)} placeholder="Активность: силовые" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-sm" />
            </div>
            <Pressable disabled={busy} type="submit" className="mt-3 h-11 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">Создать профиль</Pressable>
          </form>
        )}

        {!profile ? (
          <section className="rounded-[28px] bg-surface p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg"><Dumbbell size={25} /></div>
            <h2 className="mt-4 text-xl font-bold">Соберём твою систему</h2>
            <p className="mt-2 text-sm text-muted-2">Создай профиль для зала, коньков или любой другой активности. У каждого будут свои программа, цели и история.</p>
            <Pressable onClick={() => setShowProfileForm(true)} className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">Создать первый профиль</Pressable>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
              {(["Обзор", "Программа", "Питание", "Мои данные"] as Tab[]).map((value) => (
                <button key={value} onClick={() => setTab(value)} className={`h-10 rounded-xl px-1 text-[11px] font-semibold transition-colors ${tab === value ? "bg-ink text-on-ink" : "text-muted-2"}`}>{value}</button>
              ))}
            </div>

            {tab === "Обзор" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<Flame size={17} />} value={`${activityStreak}`} unit="дней" label="серия активности" detail="Любое движение засчитывается" />
                  <StatCard icon={<Dumbbell size={17} />} value={`${trainingStreak}`} unit="занятий" label="серия тренировок" detail={`цель — раз в ${profile.workoutIntervalDays} дн.`} />
                </div>
                <section className="rounded-[28px] bg-ink p-5 text-on-ink">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-on-ink-muted">СЛЕДУЮЩЕЕ ЗАНЯТИЕ</p>
                      <h2 className="mt-1 text-2xl font-bold">День {selectedDay}</h2>
                      <p className="mt-1 text-sm text-on-ink-muted">{plan.length ? `${plan.length} упражнений · ${plan.reduce((sum, item) => sum + item.sets, 0)} подходов` : "Добавь упражнения в программу"}</p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-on-ink/10"><Dumbbell size={21} /></span>
                  </div>
                  {dayOptions.length > 1 && <div className="mt-3 flex gap-2">{dayOptions.map((day) => <button key={day} type="button" onClick={() => setDayLabel(day)} className={`h-8 rounded-full px-3 text-xs font-bold ${day === selectedDay ? "bg-on-ink text-ink" : "bg-on-ink/10 text-on-ink-muted"}`}>День {day}</button>)}</div>}
                  <Pressable disabled={!plan.length} onClick={startWorkout} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-on-ink text-sm font-bold text-ink disabled:opacity-40"><Activity size={17} /> Начать тренировку</Pressable>
                  <div className="mt-4 flex items-center justify-between text-xs text-on-ink-muted">
                    <span>Тренировки за 7 дней</span><span>{weeklyWorkouts} / {weeklyTarget}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-on-ink/10"><div className="h-full rounded-full bg-on-ink" style={{ width: `${Math.min(100, weeklyWorkouts / Math.max(weeklyTarget, 1) * 100)}%` }} /></div>
                </section>
                <ActivityChart dates={activityDays} today={today} />
                <WeightChart measurements={measurements} targetWeight={profile.targetWeightKg} />
                <div className="flex gap-2">
                  <Pressable disabled={todayActivity || busy} onClick={markActivity} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold ${todayActivity ? "bg-surface text-muted-2" : "bg-surface text-fg"}`}>
                    {todayActivity ? <Check size={17} /> : <Footprints size={17} />}{todayActivity ? "Активность есть" : "Отметить активность"}
                  </Pressable>
                  <Pressable onClick={() => setTab("Мои данные")} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface px-4 text-sm font-bold"><Ruler size={17} /> Замеры</Pressable>
                </div>
                <SectionTitle title="История занятий" right={workouts.length > 5 ? <button onClick={() => setShowAllWorkouts((value) => !value)} className="text-xs font-semibold text-muted-2">{showAllWorkouts ? "Свернуть" : "Все занятия"}</button> : undefined} />
                {workouts.length ? workouts.slice(0, showAllWorkouts ? 200 : 5).map((workout) => <WorkoutCard key={workout.id} workout={workout} />) : <p className="rounded-2xl bg-surface p-4 text-sm text-muted-2">История появится после первого занятия.</p>}
              </>
            )}

            {tab === "Программа" && (
              <>
                <section className="rounded-[28px] bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-semibold text-muted-2">ТВОЙ ПЛАН</p><h2 className="mt-1 text-xl font-bold">День {selectedDay}</h2></div>
                    <Pressable onClick={addDay} className="flex h-10 items-center gap-1 rounded-full bg-bg px-3 text-xs font-bold"><Plus size={15} /> День</Pressable>
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {dayOptions.map((day) => <button key={day} onClick={() => setDayLabel(day)} className={`h-9 min-w-10 rounded-full px-3 text-sm font-bold ${day === selectedDay ? "bg-ink text-on-ink" : "bg-bg text-muted-2"}`}>{day}</button>)}
                  </div>
                  {plan.length ? <div className="mt-3 divide-y divide-line/70">{plan.map((exercise, index) => (
                    <div key={exercise.id} className="flex items-center gap-2 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg text-xs font-bold">{exercise.sets}×</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{exercise.title}</p><p className="mt-0.5 text-xs text-muted-2">{exercise.sets} подхода · {exercise.reps} {exercise.unit}{exercise.weightKg != null ? ` · ${exercise.weightKg} кг` : ""}</p></div>
                      <div className="flex flex-col"><button disabled={index === 0 || busy} onClick={() => moveExercise(index, -1)} aria-label="Переместить выше" className="flex h-5 w-7 items-center justify-center text-muted-2 disabled:opacity-20"><ArrowUp size={13} /></button><button disabled={index === plan.length - 1 || busy} onClick={() => moveExercise(index, 1)} aria-label="Переместить ниже" className="flex h-5 w-7 items-center justify-center text-muted-2 disabled:opacity-20"><ArrowDown size={13} /></button></div>
                      <button onClick={() => openExerciseEditor(exercise)} aria-label="Изменить упражнение" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-2"><Pencil size={15} /></button>
                      <button onClick={() => void run(() => deleteSportExerciseAction(exercise.id), "Упражнение удалено")} aria-label="Удалить упражнение" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-2"><Trash2 size={15} /></button>
                    </div>
                  ))}</div> : <p className="mt-4 rounded-2xl bg-bg p-4 text-sm text-muted-2">В этом дне пока нет упражнений. Добавь первое ниже.</p>}
                  <Pressable onClick={() => openExerciseEditor()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-bg text-sm font-bold"><Plus size={17} /> Добавить упражнение</Pressable>
                </section>
                <section className="rounded-[24px] bg-surface p-4">
                  <div className="flex gap-3"><Target size={18} className="mt-0.5 shrink-0" /><p className="text-sm text-muted-2">Цели программы всегда можно изменить. В тренировке укажи фактический результат и включи «Сохранить как цель» — следующее занятие предложит именно его.</p></div>
                </section>
              </>
            )}

            {tab === "Питание" && (
              <>
                <section className="rounded-[28px] bg-surface p-4">
                  <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold text-muted-2">ДНЕВНИК ПИТАНИЯ</p><h2 className="mt-1 text-xl font-bold">КБЖУ за день</h2></div><div className="flex items-center gap-1"><button aria-label="Предыдущий день" onClick={() => setNutritionDate((date) => shiftDay(date, -1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><ArrowLeft size={16} /></button><input aria-label="Дата дневника" type="date" value={nutritionDate} onChange={(event) => setNutritionDate(event.target.value)} className="h-9 w-[135px] rounded-xl bg-bg px-2 text-xs" /><button aria-label="Следующий день" onClick={() => setNutritionDate((date) => shiftDay(date, 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><ArrowRight size={16} /></button></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">{([
                    ["Ккал", consumed.calories, nutritionGoal?.calories, "goalCalories"],
                    ["Белки", consumed.protein, nutritionGoal?.protein, "goalProtein"],
                    ["Жиры", consumed.fat, nutritionGoal?.fat, "goalFat"],
                    ["Углеводы", consumed.carbs, nutritionGoal?.carbs, "goalCarbs"],
                  ] as const).map(([label, value, target]) => <div key={label} className="rounded-2xl bg-bg p-3"><div className="flex items-baseline justify-between gap-1"><span className="text-xs text-muted-2">{label}</span><b className="text-sm tabular-nums">{Number.isInteger(value) ? value : value.toFixed(1)}<span className="font-normal text-muted-2">{target == null ? "" : ` / ${target}`}</span></b></div>{target != null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, value / Math.max(target, 1) * 100)}%` }} /></div>}</div>)}</div>
                  <form onSubmit={saveNutritionGoals} className="mt-4 rounded-2xl border border-line/70 p-3"><p className="mb-2 text-xs font-bold">Мои дневные цели</p><div className="grid grid-cols-4 gap-2">{[["Ккал", goalCalories, setGoalCalories], ["Белки", goalProtein, setGoalProtein], ["Жиры", goalFat, setGoalFat], ["Углеводы", goalCarbs, setGoalCarbs]].map(([label, value, setter]) => <label key={label as string} className="text-[10px] text-muted-2">{label as string}<input type="number" min="0" step="1" value={value as string} onChange={(event) => (setter as (v: string) => void)(event.target.value)} className="field-input mt-1 h-9 px-2 text-xs" /></label>)}</div><Pressable disabled={busy} type="submit" className="mt-2 h-9 w-full rounded-xl bg-bg text-xs font-bold">Сохранить цели</Pressable></form>
                </section>
                <section className="rounded-[28px] bg-surface p-4"><SectionTitle title="Что съела" right={<span className="text-xs text-muted-2">{formatDate(nutritionDate, "d MMMM")}</span>} />
                  {dayFoodEntries.length ? <div className="divide-y divide-line/70">{dayFoodEntries.map((entry) => <div key={entry.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.name}</p><p className="text-xs text-muted-2">{entry.calories} ккал · Б {entry.protein} · Ж {entry.fat} · У {entry.carbs}</p></div><button disabled={busy} onClick={() => void run(() => deleteSportFoodEntryAction(entry.id), "Запись удалена")} aria-label={`Удалить ${entry.name}`} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-2"><Trash2 size={15} /></button></div>)}</div> : <p className="py-3 text-sm text-muted-2">За этот день записей пока нет.</p>}
                  <form onSubmit={addFoodEntry} className="mt-2 space-y-2 border-t border-line/70 pt-3"><Field label="Продукт или приём пищи"><input required value={foodName} onChange={(event) => setFoodName(event.target.value)} placeholder="Например, овсянка с бананом" className="field-input" /></Field><div className="grid grid-cols-4 gap-2">{[["Ккал", foodCalories, setFoodCalories], ["Белки, г", foodProtein, setFoodProtein], ["Жиры, г", foodFat, setFoodFat], ["Углеводы, г", foodCarbs, setFoodCarbs]].map(([label, value, setter]) => <label key={label as string} className="text-[10px] text-muted-2">{label as string}<input required type="number" min="0" step="1" value={value as string} onChange={(event) => (setter as (v: string) => void)(event.target.value)} className="field-input mt-1 h-10 px-2 text-xs" /></label>)}</div><Pressable disabled={busy} type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-on-ink"><Plus size={16} /> Добавить запись</Pressable></form>
                </section>
              </>
            )}

            {tab === "Мои данные" && (
              <>
                <form onSubmit={saveProfile} className="rounded-[28px] bg-surface p-4">
                  <h2 className="text-lg font-bold">Профиль и цели</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Field label="Профиль"><input required value={profileNameEdit} onChange={(event) => setProfileNameEdit(event.target.value)} className="field-input" /></Field>
                    <Field label="Активность"><input required value={profileActivityEdit} onChange={(event) => setProfileActivityEdit(event.target.value)} className="field-input" /></Field>
                    <Field label="Рост, см"><input type="number" min="80" max="250" step="0.1" value={profileHeight} onChange={(event) => setProfileHeight(event.target.value)} placeholder="170" className="field-input" /></Field>
                    <Field label="Целевой вес, кг"><input type="number" min="20" max="500" step="0.1" value={profileTargetWeight} onChange={(event) => setProfileTargetWeight(event.target.value)} placeholder="Не задан" className="field-input" /></Field>
                    <Field label="Целевая талия, см"><input type="number" min="20" max="250" step="0.1" value={profileTargetWaist} onChange={(event) => setProfileTargetWaist(event.target.value)} placeholder="Не задана" className="field-input" /></Field>
                    <Field label="Целевые бёдра, см"><input type="number" min="20" max="250" step="0.1" value={profileTargetHips} onChange={(event) => setProfileTargetHips(event.target.value)} placeholder="Не заданы" className="field-input" /></Field>
                    <Field label="Занятия раз в, дней"><input type="number" min="1" max="14" value={profileInterval} onChange={(event) => setProfileInterval(event.target.value)} className="field-input" /></Field>
                  </div>
                  <Pressable disabled={busy} type="submit" className="mt-3 h-11 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">Сохранить профиль</Pressable>
                </form>

                <section className="rounded-[28px] bg-surface p-4">
                  <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-muted-2">ПРОГРЕСС ТЕЛА</p><h2 className="mt-1 text-lg font-bold">Замеры сегодня</h2></div><span className="text-xs font-semibold text-muted-2">{formatDate(today, "d MMM")}</span></div>
                  <div className="mt-3 grid grid-cols-[128px_1fr] gap-3">
                    <BodyFigure focus={bodyFocus} onFocus={(value) => { setBodyFocus(value); document.getElementById(`sport-${value}`)?.focus(); }} />
                    <form onSubmit={saveMeasurement} className="space-y-2">
                      <Field label="Вес, кг"><input type="number" min="20" max="500" step="0.1" value={weightValue} onChange={(event) => setWeightValue(event.target.value)} placeholder="—" className="field-input" /></Field>
                      <Field label="Грудь, см"><input id="sport-chest" type="number" min="20" max="250" step="0.1" value={chestValue} onFocus={() => setBodyFocus("chest")} onChange={(event) => setChestValue(event.target.value)} placeholder="—" className="field-input" /></Field>
                      <Field label="Талия, см"><input id="sport-waist" type="number" min="20" max="250" step="0.1" value={waistValue} onFocus={() => setBodyFocus("waist")} onChange={(event) => setWaistValue(event.target.value)} placeholder="—" className="field-input" /></Field>
                      <Field label="Бёдра, см"><input id="sport-hips" type="number" min="20" max="250" step="0.1" value={hipsValue} onFocus={() => setBodyFocus("hips")} onChange={(event) => setHipsValue(event.target.value)} placeholder="—" className="field-input" /></Field>
                      <Pressable disabled={busy} type="submit" className="h-10 w-full rounded-xl bg-ink text-xs font-bold text-on-ink">Сохранить замеры</Pressable>
                    </form>
                  </div>
                  <p className="mt-3 text-xs text-muted-2">Нажми на точку фигуры, чтобы выбрать область для замера. История веса и параметров сохраняется по дням.</p>
                </section>
                {measurements.length > 0 && <section className="rounded-[24px] bg-surface p-4"><h2 className="font-bold">История замеров</h2><div className="mt-2 divide-y divide-line/70">{measurements.slice(-6).reverse().map((measurement) => <div key={measurement.id} className="flex items-center justify-between gap-3 py-2.5"><span className="shrink-0 text-xs font-semibold text-muted-2">{formatDate(measurement.date, "d MMM yyyy")}</span><span className="flex flex-wrap justify-end gap-x-2 text-[10px] font-medium">{measurement.weightKg != null && <span>{measurement.weightKg} кг</span>}{measurement.waistCm != null && <span>талия {measurement.waistCm}</span>}{measurement.hipsCm != null && <span>бёдра {measurement.hipsCm}</span>}</span></div>)}</div></section>}
                {bodyGoals.length > 0 && <section className="rounded-[24px] bg-surface p-4"><div className="mb-2 flex items-center gap-2"><Target size={17} /><h2 className="font-bold">Цели фигуры</h2></div><div className="grid grid-cols-3 gap-2">{bodyGoals.map((goal) => <div key={goal.label} className="rounded-xl bg-bg p-2"><p className="text-[10px] text-muted-2">{goal.label}</p><p className="mt-1 text-sm font-bold">{Math.abs(goal.target - goal.current).toFixed(1)} {goal.unit}</p><p className="text-[9px] text-muted-2">цель {goal.target} {goal.unit}</p></div>)}</div></section>}
                <Pressable onClick={() => { if (window.confirm(`Удалить профиль «${profile.name}» и всю его историю?`)) void run(() => deleteSportProfileAction(profile.id), "Профиль удалён").then((ok) => { if (ok) setProfileId(data.profiles.find((item) => item.id !== profile.id)?.id ?? null); }); }} className="h-11 w-full rounded-xl text-sm font-semibold text-muted-2">Удалить профиль и его историю</Pressable>
              </>
            )}
          </>
        )}
      </div>

      {exerciseEditor !== false && profile && (
        <Overlay title={exerciseEditor ? "Изменить упражнение" : "Новое упражнение"} onClose={() => setExerciseEditor(false)}>
          <form onSubmit={saveExercise}>
            <Field label="Название"><input autoFocus required value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} placeholder="Приседания" className="field-input" /></Field>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Field label="Подходы"><input required type="number" min="1" max="100" value={exerciseSets} onChange={(event) => setExerciseSets(event.target.value)} className="field-input" /></Field>
              <Field label="Цель"><input required type="number" min="1" max="1000" value={exerciseReps} onChange={(event) => setExerciseReps(event.target.value)} className="field-input" /></Field>
              <Field label="Вес, кг"><input type="number" min="0" max="1000" step="0.5" value={exerciseWeight} onChange={(event) => setExerciseWeight(event.target.value)} placeholder="—" className="field-input" /></Field>
            </div>
            <Field label="Единица"><select value={exerciseUnit} onChange={(event) => setExerciseUnit(event.target.value as SportExerciseUnit)} className="field-input"><option value="повторов">Повторения</option><option value="минут">Минуты</option><option value="кругов">Круги</option></select></Field>
            <p className="mt-3 text-xs text-muted-2">День программы: <b>{exerciseEditorDay}</b></p>
            <Pressable disabled={busy} type="submit" className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">Сохранить</Pressable>
          </form>
        </Overlay>
      )}

      {workoutOpen && profile && (
        <Overlay title={`День ${selectedDay} · ${formatDate(today, "d MMMM")}`} onClose={() => setWorkoutOpen(false)}>
          <form onSubmit={saveWorkout}>
            <p className="text-sm text-muted-2">Отметь выполненные упражнения и запиши фактический результат.</p>
            <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
              {plan.map((exercise) => {
                const log = workoutLog[exercise.id] ?? { completed: false, reps: String(exercise.reps), weight: exercise.weightKg?.toString() ?? "" };
                return <div key={exercise.id} className={`rounded-2xl p-3 ${log.completed ? "bg-ink text-on-ink" : "bg-bg"}`}>
                  <button type="button" onClick={() => setWorkoutLog((current) => ({ ...current, [exercise.id]: { ...log, completed: !log.completed } }))} className="flex w-full items-center gap-3 text-left">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${log.completed ? "border-on-ink bg-on-ink text-ink" : "border-current"}`}>{log.completed && <Check size={14} />}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-sm">{exercise.title}</b><small className="opacity-70">план: {exercise.sets} × {exercise.reps} {exercise.unit}{exercise.weightKg != null ? ` · ${exercise.weightKg} кг` : ""}</small></span>
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-9">
                    <label className="text-[10px] font-semibold opacity-70">Факт, {exercise.unit}<input type="number" min="0" max="1000" value={log.reps} onChange={(event) => setWorkoutLog((current) => ({ ...current, [exercise.id]: { ...log, reps: event.target.value } }))} className="mt-1 h-9 w-full rounded-lg bg-on-ink/10 px-2 text-sm text-current" /></label>
                    <label className="text-[10px] font-semibold opacity-70">Факт, кг<input type="number" min="0" max="1000" step="0.5" value={log.weight} onChange={(event) => setWorkoutLog((current) => ({ ...current, [exercise.id]: { ...log, weight: event.target.value } }))} placeholder="—" className="mt-1 h-9 w-full rounded-lg bg-on-ink/10 px-2 text-sm text-current" /></label>
                  </div>
                </div>;
              })}
            </div>
            <Field label="Заметка"><input value={workoutNote} onChange={(event) => setWorkoutNote(event.target.value)} placeholder="Самочувствие, комментарий" className="field-input" /></Field>
            <label className="mt-3 flex items-start gap-2 rounded-xl bg-bg p-3 text-xs"><input type="checkbox" checked={applyActual} onChange={(event) => setApplyActual(event.target.checked)} className="mt-0.5" /><span><b>Сохранить факт как цель программы</b><span className="mt-0.5 block text-muted-2">Для выполненных упражнений следующий раз будет предложен этот результат.</span></span></label>
            <Pressable disabled={busy} type="submit" className="mt-4 h-12 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">Сохранить тренировку</Pressable>
          </form>
        </Overlay>
      )}
    </>
  );
}

function StatCard({ icon, value, unit, label, detail }: { icon: ReactNode; value: string; unit: string; label: string; detail: string }) {
  return <section className="rounded-[24px] bg-surface p-4"><div className="flex items-center justify-between text-muted-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg">{icon}</span><span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span></div><div className="mt-3 flex items-baseline gap-1"><b className="text-3xl tabular-nums">{value}</b><span className="text-xs font-semibold text-muted-2">{unit}</span></div><p className="mt-1 text-[10px] text-muted-2">{detail}</p></section>;
}

function ActivityChart({ dates, today }: { dates: Set<string>; today: string }) {
  const days = Array.from({ length: 14 }, (_, index) => shiftDay(today, index - 13));
  return <section className="rounded-[28px] bg-surface p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-muted-2">РИТМ</p><h2 className="mt-1 font-bold">Активность за 14 дней</h2></div><Activity size={19} className="text-muted-2" /></div><div className="mt-5 flex h-24 items-end gap-1.5">{days.map((date) => { const active = dates.has(date); return <div key={date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"><div className={`w-full rounded-t-md ${active ? "h-full bg-ink" : "h-2 bg-bg"}`} title={`${formatDate(date, "d MMMM")}${active ? ": активный день" : ": отдыхаю"}`} /><span className="text-[9px] text-muted-2">{formatDate(date, "EEEEE")}</span></div>; })}</div><p className="mt-3 text-xs text-muted-2">День считается активным после тренировки или отметки активности.</p></section>;
}

function WeightChart({ measurements, targetWeight }: { measurements: SportMeasurement[]; targetWeight: number | null }) {
  const points = measurements.filter((item) => item.weightKg != null).slice(-8);
  const values = points.map((item) => item.weightKg!);
  const min = Math.min(...values, targetWeight ?? Infinity);
  const max = Math.max(...values, targetWeight ?? -Infinity);
  const range = Math.max(max - min, 1);
  const coords = points.map((item, index) => `${points.length < 2 ? 50 : 8 + index * 84 / (points.length - 1)},${90 - ((item.weightKg! - min) / range) * 72}`).join(" ");
  return <section className="rounded-[28px] bg-surface p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-muted-2">ИЗМЕНЕНИЯ</p><h2 className="mt-1 font-bold">Вес и цель</h2></div><Weight size={19} className="text-muted-2" /></div>{points.length ? <><div className="mt-3 flex items-baseline justify-between"><b className="text-2xl tabular-nums">{formatWeight(points.at(-1)?.weightKg)}</b><span className="text-xs text-muted-2">{targetWeight == null ? "цель не задана" : `цель ${formatWeight(targetWeight)}`}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-28 w-full overflow-visible" aria-label="График изменения веса"><line x1="0" x2="100" y1="90" y2="90" stroke="currentColor" className="text-line" strokeWidth=".5" />{targetWeight != null && <line x1="0" x2="100" y1={90 - ((targetWeight - min) / range) * 72} y2={90 - ((targetWeight - min) / range) * 72} stroke="currentColor" strokeDasharray="2 2" className="text-muted" strokeWidth=".7" />}<polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-fg" points={coords} />{points.map((point, index) => { const [x, y] = coords.split(" ")[index]!.split(","); return <circle key={point.id} cx={x} cy={y} r="2" className="fill-fg" />; })}</svg><div className="flex justify-between text-[10px] text-muted-2"><span>{formatDate(points[0]!.date, "d MMM")}</span><span>{formatDate(points.at(-1)!.date, "d MMM")}</span></div></> : <p className="mt-3 rounded-2xl bg-bg p-4 text-sm text-muted-2">Добавь первый замер — здесь появится график прогресса.</p>}</section>;
}

function BodyFigure({ focus, onFocus }: { focus: "chest" | "waist" | "hips"; onFocus: (value: "chest" | "waist" | "hips") => void }) {
  const points = [{ key: "chest" as const, label: "Грудь", x: 62, y: 91 }, { key: "waist" as const, label: "Талия", x: 62, y: 125 }, { key: "hips" as const, label: "Бёдра", x: 62, y: 151 }];
  return <div className="relative flex h-64 items-center justify-center rounded-2xl bg-bg" aria-label="Интерактивная схема замеров тела">
    <svg viewBox="0 0 124 230" className="h-[90%] w-full" aria-hidden="true">
      <circle cx="62" cy="25" r="15" fill="currentColor" className="text-muted-2" />
      <path d="M49 44 Q62 39 75 44 L83 60 Q91 67 85 80 L79 93 L81 121 Q84 131 77 139 L83 166 L91 210 L75 213 L62 174 L49 213 L33 210 L41 166 L47 139 Q40 131 43 121 L45 93 L39 80 Q33 67 41 60 Z" fill="currentColor" className="text-muted-2" />
      <path d="M43 62 Q25 75 30 114 M81 62 Q99 75 94 114" fill="none" stroke="currentColor" className="text-muted-2" strokeWidth="9" strokeLinecap="round" />
    </svg>
    {points.map((point) => <button key={point.key} type="button" aria-label={`Выбрать замер ${point.label}`} title={point.label} onClick={() => onFocus(point.key)} className={`absolute left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all ${focus === point.key ? "scale-110 border-on-ink bg-ink text-on-ink shadow-lg" : "border-surface bg-surface/80 text-fg"}`} style={{ top: `${point.y / 230 * 100}%` }}>{point.label === "Грудь" ? "Г" : point.label === "Талия" ? "Т" : "Б"}</button>)}
    <span className="absolute bottom-2 text-[9px] font-semibold text-muted-2">ЖЕНСКАЯ ФИГУРА · ВИД СПЕРЕДИ</span>
  </div>;
}

function WorkoutCard({ workout }: { workout: SportWorkout }) {
  const doneCount = workout.exercises.filter((exercise) => exercise.completed).length;
  return <section className="mb-2 rounded-[22px] bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-muted-2">ДЕНЬ {workout.dayLabel} · {formatDate(workout.date, "d MMMM yyyy")}</p><h3 className="mt-1 font-bold">{doneCount} из {workout.exercises.length} упражнений</h3></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><Check size={17} /></span></div><div className="mt-3 flex flex-wrap gap-1.5">{workout.exercises.filter((item) => item.completed).slice(0, 5).map((item) => <span key={item.id} className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-medium">{item.title} · {item.actualReps ?? item.targetReps} {item.targetUnit}</span>)}</div>{workout.note && <p className="mt-2 text-xs text-muted-2">{workout.note}</p>}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold text-muted-2">{label}{children}</label>;
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}><section role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-surface p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><X size={17} /></button></div>{children}</section></div>;
}
