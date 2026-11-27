"use client";

import { Check, Circle, Flag, Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatDate } from "@/shared/lib/dates";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";
import { useToast } from "@/shared/ui/Toast";
import { addPersonalWishAction, deletePersonalGoalAction, deletePersonalWishAction, savePersonalGoalAction, setPersonalGoalCompletedAction, setPersonalWishCompletedAction } from "../actions";
import type { PersonalGoal, PersonalWish } from "../server";

type Category = "personal" | "purchase" | "health" | "career" | "other";
const categoryNames: Record<Category, string> = { personal: "Личное", purchase: "Покупка", health: "Здоровье", career: "Карьера", other: "Другое" };
const amount = (cents: number, currency: string) => new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export function GoalsScreen({ goals, wishes, today, currency }: { goals: PersonalGoal[]; wishes: PersonalWish[]; today: string; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<PersonalGoal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("personal");
  const [deadline, setDeadline] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [view, setView] = useState<"goals" | "wishes">("goals");
  const [wishTitle, setWishTitle] = useState("");

  const openForm = (goal?: PersonalGoal) => {
    setEditing(goal ?? null);
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setCategory((goal?.category as Category) ?? "personal");
    setDeadline(goal?.deadline ?? "");
    setTarget(goal?.targetCents == null ? "" : String(goal.targetCents / 100));
    setSaved(goal?.savedCents ? String(goal.savedCents / 100) : "");
    setFormOpen(true);
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); router.refresh(); toast.show({ message }); return true; }
    catch (error) { toast.show({ message: error instanceof Error ? error.message : "Не удалось сохранить цель" }); return false; }
    finally { setBusy(false); }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(() => savePersonalGoalAction(editing?.id ?? null, {
      title: title.trim(), description: description.trim() || null, category,
      deadline: deadline || null,
      targetCents: target.trim() ? Math.round(Number(target.replace(",", ".")) * 100) : null,
      savedCents: saved.trim() ? Math.round(Number(saved.replace(",", ".")) * 100) : 0,
      completed: editing?.completed ?? false,
    }), editing ? "Цель обновлена" : "Цель добавлена").then((ok) => { if (ok) setFormOpen(false); });
  };

  const active = goals.filter((goal) => !goal.completed);
  const completed = goals.filter((goal) => goal.completed);
  const submitWish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = wishTitle.trim();
    if (!value) return;
    void run(() => addPersonalWishAction(value), "Желание добавлено").then((ok) => { if (ok) setWishTitle(""); });
  };

  return <>
    <ScreenHeader caption="Планы и мечты" title="Цели" right={view === "goals" ? <Pressable onClick={() => openForm()} aria-label="Добавить цель" className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-on-ink"><Plus size={20} /></Pressable> : undefined} />
    <div className="mx-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
      <button onClick={() => setView("goals")} className={`h-10 rounded-xl text-sm font-semibold transition-colors ${view === "goals" ? "bg-ink text-on-ink" : "text-muted-2"}`}>Цели <span className="ml-1 opacity-70">{active.length}</span></button>
      <button onClick={() => setView("wishes")} className={`h-10 rounded-xl text-sm font-semibold transition-colors ${view === "wishes" ? "bg-ink text-on-ink" : "text-muted-2"}`}>Желания <span className="ml-1 opacity-70">{wishes.filter((wish) => !wish.completed).length}</span></button>
    </div>
    {view === "goals" ? <>
    {active.length > 0 && <section className="mx-4 rounded-[28px] bg-ink p-5 text-on-ink"><p className="text-xs font-semibold text-on-ink-muted">В ФОКУСЕ</p><h2 className="mt-1 text-2xl font-bold">{active.length} {active.length === 1 ? "цель" : "цели"}</h2><p className="mt-1 text-sm text-on-ink-muted">Запиши, чего хочешь достичь, и поставь дату.</p></section>}
    <SectionTitle title="В планах" right={<span className="text-xs text-muted-2">{active.length}</span>} />
    <div className="space-y-3 px-4">
      {active.map((goal) => {
        const progress = goal.targetCents ? Math.min(100, goal.savedCents / goal.targetCents * 100) : 0;
        const overdue = goal.deadline && goal.deadline < today;
        return <article key={goal.id} className="rounded-[24px] bg-surface p-4">
          <div className="flex items-start gap-3"><button onClick={() => void run(() => setPersonalGoalCompletedAction(goal.id, true), "Цель отмечена выполненной")} aria-label="Отметить цель выполненной" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-muted-2"><Circle size={18} /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-bg px-2 py-1 text-[10px] font-semibold text-muted-2">{categoryNames[(goal.category as Category)] ?? "Другое"}</span>{goal.deadline && <span className={`text-[10px] font-semibold ${overdue ? "text-red-500" : "text-muted-2"}`}>{overdue ? "Просрочено · " : "До "}{formatDate(goal.deadline, "d MMM yyyy")}</span>}</div><h3 className="mt-2 text-base font-bold">{goal.title}</h3>{goal.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-2">{goal.description}</p>}
            {goal.targetCents != null && <div className="mt-3"><div className="flex justify-between text-xs"><span className="text-muted-2">Накоплено {amount(goal.savedCents, currency)}</span><b>{amount(goal.targetCents, currency)}</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-ink" style={{ width: `${progress}%` }} /></div></div>}
          </div><div className="flex shrink-0"><button onClick={() => openForm(goal)} aria-label="Редактировать цель" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-2"><Pencil size={15} /></button><button onClick={() => { if (window.confirm(`Удалить цель «${goal.title}»?`)) void run(() => deletePersonalGoalAction(goal.id), "Цель удалена"); }} aria-label="Удалить цель" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-2"><Trash2 size={15} /></button></div></div>
        </article>;
      })}
      {!active.length && <div className="rounded-[24px] bg-surface px-5 py-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg"><Flag size={21} /></span><h3 className="mt-3 font-bold">Пока целей нет</h3><p className="mt-1 text-sm text-muted-2">Добавь первую цель — например, запланируй покупку или личный проект.</p><Pressable onClick={() => openForm()} className="mt-4 h-11 rounded-xl bg-ink px-5 text-sm font-bold text-on-ink"><Plus size={16} /> Добавить цель</Pressable></div>}
    </div>
    {completed.length > 0 && <><SectionTitle title="Достигнуто" right={<span className="text-xs text-muted-2">{completed.length}</span>} /><div className="space-y-2 px-4">{completed.map((goal) => <article key={goal.id} className="flex items-center gap-3 rounded-[20px] bg-surface p-4 opacity-70"><button onClick={() => void run(() => setPersonalGoalCompletedAction(goal.id, false), "Цель возвращена в план") } aria-label="Вернуть в активные" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-on-ink"><Check size={16} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold line-through">{goal.title}</p><p className="text-xs text-muted-2">{categoryNames[goal.category as Category] ?? "Другое"}{goal.targetCents != null ? ` · ${amount(goal.targetCents, currency)}` : ""}</p></div><button onClick={() => { if (window.confirm(`Удалить цель «${goal.title}»?`)) void run(() => deletePersonalGoalAction(goal.id), "Цель удалена"); }} aria-label="Удалить цель" className="flex h-9 w-9 items-center justify-center text-muted-2"><Trash2 size={15} /></button></article>)}</div></>}
    {formOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setFormOpen(false)}><section role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-surface p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? "Изменить цель" : "Новая цель"}</h2><button type="button" onClick={() => setFormOpen(false)} aria-label="Закрыть" className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><X size={17} /></button></div><form onSubmit={submit} className="space-y-3"><label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Название<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, купить велосипед" className="field-input" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Категория<select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="field-input"><option value="personal">Личное</option><option value="purchase">Покупка</option><option value="health">Здоровье</option><option value="career">Карьера</option><option value="other">Другое</option></select></label><label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Дедлайн<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="field-input" /></label>{category === "purchase" && <div className="grid grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Стоимость<input required type="number" min="0.01" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" className="field-input" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Уже отложено<input type="number" min="0" step="0.01" value={saved} onChange={(event) => setSaved(event.target.value)} placeholder="0" className="field-input" /></label></div>}<label className="flex flex-col gap-1 text-xs font-semibold text-muted-2">Заметка<textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Зачем тебе это и что поможет прийти к цели" className="field-input resize-y py-2" /></label><Pressable disabled={busy} type="submit" className="h-11 w-full rounded-xl bg-ink text-sm font-bold text-on-ink">{editing ? "Сохранить" : "Добавить цель"}</Pressable></form></section></div>}
    </> : <section className="mx-4 rounded-[28px] bg-surface p-4">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg"><Heart size={20} /></span><div><h2 className="font-bold">Список желаний</h2><p className="text-xs text-muted-2">Идеи и мечты без дедлайнов</p></div></div>
      <form onSubmit={submitWish} className="mt-4 flex gap-2"><input maxLength={180} value={wishTitle} onChange={(event) => setWishTitle(event.target.value)} placeholder="Хочу однажды…" className="field-input min-w-0 flex-1" /><Pressable type="submit" disabled={busy || !wishTitle.trim()} aria-label="Добавить желание" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink disabled:opacity-40"><Plus size={19} /></Pressable></form>
      <div className="mt-3 divide-y divide-line/70">{wishes.map((wish) => <div key={wish.id} className="flex items-center gap-3 py-3"><button onClick={() => void run(() => setPersonalWishCompletedAction(wish.id, !wish.completed), wish.completed ? "Желание возвращено в список" : "Желание исполнено")} aria-label={wish.completed ? "Вернуть желание в список" : "Отметить исполненным"} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${wish.completed ? "bg-ink text-on-ink" : "bg-bg text-muted-2"}`}>{wish.completed ? <Check size={16} /> : <Circle size={18} />}</button><p className={`min-w-0 flex-1 text-sm font-medium ${wish.completed ? "text-muted-2 line-through" : ""}`}>{wish.title}</p><button onClick={() => { if (window.confirm(`Удалить желание «${wish.title}»?`)) void run(() => deletePersonalWishAction(wish.id), "Желание удалено"); }} aria-label="Удалить желание" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-2"><Trash2 size={15} /></button></div>)}</div>
      {wishes.length === 0 && <p className="py-5 text-center text-sm text-muted-2">Пока пусто. Запиши сюда то, что хочется сделать когда-нибудь.</p>}
    </section>}
  </>;
}
