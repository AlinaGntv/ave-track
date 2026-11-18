"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Play, Plus, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { shiftDate } from "@/shared/lib/dates";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";
import { useToast } from "@/shared/ui/Toast";
import {
  addTimeEntryAction,
  clearTimeEntriesAction,
  deleteTimeEntryAction,
  importTimeEntriesAction,
  startTimeTrackerAction,
  stopTimeTrackerAction,
} from "../actions";
import type { ActiveTimer, TimeEntry } from "../server";

const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return shiftDate(date, -(weekday === 0 ? 6 : weekday - 1));
}

function formatShort(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours && !rest) return "0м";
  if (hours && rest) return `${hours}ч ${rest}м`;
  return hours ? `${hours}ч` : `${rest}м`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function formatRecordDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}ч ${rest}м` : `${rest}м`;
}

function formatDateTime(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getLegacyRecords(file: unknown): Array<{ id: string; name: string; durationMs: number; date: number }> {
  let value = file as { localStorage?: Record<string, unknown> } | unknown;
  const storage = (value as { localStorage?: Record<string, unknown> } | null)?.localStorage;
  value = storage?.timeTrackerDataV2 ?? value;
  if (typeof value === "string") value = JSON.parse(value) as unknown;
  if (!Array.isArray(value)) throw new Error("В файле не найден список timeTrackerDataV2");
  return value.map((record, index) => {
    if (!record || typeof record !== "object") throw new Error(`Некорректная запись №${index + 1}`);
    const row = record as { id?: unknown; name?: unknown; duration?: unknown; date?: unknown };
    const date = typeof row.date === "string" ? Date.parse(row.date) : NaN;
    if (
      (typeof row.id !== "number" && typeof row.id !== "string") ||
      typeof row.name !== "string" ||
      typeof row.duration !== "number" ||
      !Number.isFinite(row.duration) ||
      row.duration <= 0 ||
      !Number.isFinite(date)
    ) {
      throw new Error(`Некорректные данные в записи №${index + 1}`);
    }
    return { id: String(row.id), name: row.name.trim() || "Без названия", durationMs: Math.round(row.duration), date };
  });
}

export function TimeTrackerScreen({
  entries: serverEntries,
  activeTimer: serverTimer,
  today,
  timezone,
}: {
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  today: string;
  timezone: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [taskName, setTaskName] = useState("");
  const [activeTimer, setActiveTimer] = useState(serverTimer);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [manualTime, setManualTime] = useState(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(Date.now()),
  );
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [reportStart, setReportStart] = useState(shiftDate(today, -6));
  const [reportEnd, setReportEnd] = useState(today);

  useEffect(() => setActiveTimer(serverTimer), [serverTimer]);
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const stats = useMemo(() => {
    const startThisWeek = weekStart(today);
    const startLastWeek = shiftDate(startThisWeek, -7);
    const yesterday = shiftDate(today, -1);
    const month = today.slice(0, 7);
    const year = today.slice(0, 4);
    const totals = { today: 0, yesterday: 0, week: 0, lastWeek: 0, month: 0, year: 0 };
    for (const record of serverEntries) {
      const date = dateKey(record.date, timezone);
      if (date === today) totals.today += record.durationMs;
      if (date === yesterday) totals.yesterday += record.durationMs;
      if (date >= startThisWeek) totals.week += record.durationMs;
      if (date >= startLastWeek && date < startThisWeek) totals.lastWeek += record.durationMs;
      if (date.startsWith(month)) totals.month += record.durationMs;
      if (date.startsWith(year)) totals.year += record.durationMs;
    }
    return totals;
  }, [serverEntries, today, timezone]);

  const report = useMemo(() => {
    const days = new Map<string, number>();
    let total = 0;
    if (reportStart && reportEnd && reportStart <= reportEnd) {
      for (const record of serverEntries) {
        const date = dateKey(record.date, timezone);
        if (date < reportStart || date > reportEnd) continue;
        total += record.durationMs;
        days.set(date, (days.get(date) ?? 0) + record.durationMs);
      }
    }
    return { total, days: [...days.entries()].sort(([a], [b]) => b.localeCompare(a)) };
  }, [serverEntries, reportStart, reportEnd, timezone]);

  const run = async (work: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      await work();
      router.refresh();
      if (success) toast.show({ message: success });
      return true;
    } catch (error) {
      console.error(error);
      toast.show({ message: "Не удалось сохранить изменения" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleTimer = () => {
    if (activeTimer) {
      const previous = activeTimer;
      setActiveTimer(null);
      void run(stopTimeTrackerAction).then((ok) => {
        if (ok) setTaskName("");
        else setActiveTimer(previous);
      });
      return;
    }
    const name = taskName.trim() || "Без названия";
    const startedAt = Date.now();
    setActiveTimer({ name, startedAt });
    void run(() => startTimeTrackerAction(name)).then((ok) => {
      if (!ok) setActiveTimer(null);
    });
  };

  const addManual = () => {
    const hours = Number(manualHours) || 0;
    const minutes = Number(manualMinutes) || 0;
    const durationMs = (hours * 60 + minutes) * 60_000;
    if (hours < 0 || minutes < 0 || minutes > 59 || !durationMs) {
      toast.show({ message: "Укажи потраченное время" });
      return;
    }
    const date = fromZonedTime(`${manualDate}T${manualTime || "12:00"}:00`, timezone).getTime();
    if (!Number.isFinite(date)) {
      toast.show({ message: "Проверь дату и время" });
      return;
    }
    void run(
      () => addTimeEntryAction({ name: manualName.trim() || "Без названия", durationMs, date }),
      "Запись добавлена",
    ).then((ok) => {
      if (ok) {
        setManualName("");
        setManualHours("");
        setManualMinutes("");
      }
    });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const records = getLegacyRecords(parsed);
      await run(
        async () => {
          const result = await importTimeEntriesAction(records);
          toast.show({ message: `Импортировано ${result.imported}, пропущено ${result.skipped}` });
        },
      );
    } catch (error) {
      console.error(error);
      toast.show({ message: error instanceof Error ? error.message : "Не удалось прочитать файл" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const periodButtons = [7, 30, 365].map((days) => ({
    days,
    label: days === 365 ? "Год" : `${days} дней`,
  }));

  return (
    <>
      <ScreenHeader caption="Учёт времени" title="Трекер" />

      <section className="mx-4 rounded-[28px] bg-ink p-5 text-on-ink shadow-soft md:mx-6 md:p-7">
        <div className="text-xs font-semibold text-on-ink/60">Сейчас</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-4xl font-bold tabular-nums md:text-5xl">
            {formatDuration(activeTimer ? now - activeTimer.startedAt : 0)}
          </span>
          <span className="max-w-full truncate text-sm font-medium text-on-ink/75">
            {activeTimer ? `/ ${activeTimer.name}` : "/ нет задачи"}
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            disabled={!!activeTimer || busy}
            placeholder="Название текущей задачи…"
            className="h-12 min-w-0 flex-1 rounded-2xl bg-on-ink/10 px-4 text-sm text-on-ink outline-none placeholder:text-on-ink/45 disabled:opacity-60"
          />
          <Pressable
            disabled={busy}
            onClick={toggleTimer}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold transition-colors ${activeTimer ? "bg-white/15 text-on-ink" : "bg-white text-ink"}`}
          >
            {activeTimer ? <Square size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {activeTimer ? "Стоп" : "Старт"}
          </Pressable>
        </div>
      </section>

      <SectionTitle title="Статистика" />
      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 md:mx-2 md:px-4">
        {[
          ["Сегодня", stats.today],
          ["Вчера", stats.yesterday],
          ["Эта неделя", stats.week],
          ["Прошлая неделя", stats.lastWeek],
          ["Месяц", stats.month],
          ["Год", stats.year],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[22px] bg-surface px-4 py-4">
            <div className="text-2xl font-bold tabular-nums">{formatShort(Number(value))}</div>
            <div className="mt-1 text-xs font-medium text-muted-2">{label}</div>
          </div>
        ))}
      </div>

      <SectionTitle title="Отчёт за период" />
      <section className="mx-4 rounded-[24px] bg-surface p-4 md:mx-6 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-semibold text-muted-2">
            С
            <input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} className="h-10 rounded-xl bg-bg px-3 text-sm text-fg" />
          </label>
          <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-semibold text-muted-2">
            По
            <input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} className="h-10 rounded-xl bg-bg px-3 text-sm text-fg" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {periodButtons.map(({ days, label }) => (
            <Pressable
              key={days}
              onClick={() => {
                setReportStart(shiftDate(today, -(days - 1)));
                setReportEnd(today);
              }}
              className="h-9 rounded-full bg-bg px-3.5 text-xs font-semibold text-muted-2"
            >
              {label}
            </Pressable>
          ))}
        </div>
        <div className="mt-5 border-b border-line pb-4">
          <div className="text-3xl font-bold tabular-nums">{formatShort(report.total)}</div>
          <div className="mt-1 text-xs text-muted-2">за период</div>
        </div>
        <div className="pt-1">
          {report.days.length ? report.days.map(([date, duration]) => (
            <div key={date} className="flex items-center justify-between border-b border-line/70 py-3 last:border-0">
              <span className="text-sm font-medium capitalize text-muted-2">
                {new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`))}
              </span>
              <span className="text-sm font-bold tabular-nums">{formatShort(duration)}</span>
            </div>
          )) : <p className="py-4 text-center text-sm text-muted-2">Нет записей за этот период</p>}
        </div>
      </section>

      <SectionTitle title="Добавить вручную" />
      <section className="mx-4 rounded-[24px] bg-surface p-4 md:mx-6 md:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Название задачи" className="col-span-2 h-11 rounded-xl bg-bg px-3 text-sm sm:col-span-4" />
          <input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} className="h-11 min-w-0 rounded-xl bg-bg px-2 text-sm" />
          <input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} className="h-11 min-w-0 rounded-xl bg-bg px-2 text-sm" />
          <input type="number" min="0" max="24" value={manualHours} onChange={(event) => setManualHours(event.target.value)} placeholder="Часы" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-sm" />
          <input type="number" min="0" max="59" value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} placeholder="Минуты" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-sm" />
        </div>
        <Pressable disabled={busy} onClick={addManual} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-on-ink">
          <Plus size={17} /> Добавить запись
        </Pressable>
      </section>

      <SectionTitle
        title="Последние записи"
        right={<span className="text-xs font-semibold text-muted-2">{serverEntries.length} записей</span>}
      />
      {serverEntries.length === 0 ? (
        <div className="mx-4 rounded-[24px] border border-dashed border-line px-5 py-8 text-center text-sm text-muted-2 md:mx-6">Пока нет записей</div>
      ) : (
        <div className="mx-4 overflow-hidden rounded-[24px] bg-surface md:mx-6">
          {serverEntries.slice(0, 15).map((record) => (
            <div key={record.id} className="flex min-w-0 items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-muted-2"><Clock3 size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{record.name}</p>
                <p className="mt-0.5 text-xs text-muted-2">{formatDateTime(record.date, timezone)}</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">{formatRecordDuration(record.durationMs)}</span>
              <Pressable aria-label={`Удалить запись ${record.name}`} onClick={() => {
                if (window.confirm("Удалить эту запись?")) void run(() => deleteTimeEntryAction(record.id));
              }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-2 hover:bg-bg hover:text-fg">
                <Trash2 size={16} />
              </Pressable>
            </div>
          ))}
        </div>
      )}

      <div className="mx-4 mt-4 mb-8 flex flex-wrap items-center justify-between gap-3 md:mx-6">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-xs font-semibold text-muted-2">
          <Upload size={15} /> Импорт из localStorage
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </label>
        {serverEntries.length > 0 && (
          <Pressable onClick={() => {
            if (window.confirm("Удалить всю историю трекера? Это действие нельзя отменить.")) void run(clearTimeEntriesAction, "История удалена");
          }} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-muted-2 hover:bg-surface">
            <RotateCcw size={14} /> Сбросить всё
          </Pressable>
        )}
      </div>
    </>
  );
}
