/**
 * Восстановление базы из выгрузки страниц сайта (когда файл базы с сервера забрать нельзя).
 *
 * Выгрузка — файл, который сохраняет строка в консоли браузера на работающем сайте:
 * она запрашивает /smart/all, /smart/completed, /money и /settings и склеивает ответы.
 * Скрипт достаёт из них списки, задачи (с повторами, заметками, подзадачами), деньги,
 * цели и настройки и собирает новый файл базы со всеми миграциями.
 *
 *   node --import tsx scripts/restore-export.ts <выгрузка.txt> <новая-база.db>
 *
 * Чего в выгрузке нет: точной истории выполнений (восстанавливается только их число
 * и дата последнего), премиум-эмодзи бота и сортировки списков — их задать заново.
 */
import fs from "node:fs";
import path from "node:path";

type Rec = Record<string, unknown>;
type ExportedTask = {
  id: number;
  listId: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  dueTime: string | null;
  durationMinutes?: number | null;
  priority: number;
  flagged: boolean;
  completedAt: number | null;
  recurrence: unknown;
  earlyReminders?: string[] | null;
  completionCount: number;
  lastCompletedAt: number | null;
  sortOrder: number;
  subtasks: { id: number; title: string; completedAt: number | null }[];
};

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Использование: node --import tsx scripts/restore-export.ts <выгрузка.txt> <новая-база.db>");
  process.exit(1);
}
const outFile = path.resolve(output);
if (fs.existsSync(outFile)) {
  console.error(`Файл ${outFile} уже существует — укажите новый путь, чтобы ничего не перезаписать.`);
  process.exit(1);
}

// ── разбор выгрузки: страницы → строки RSC "id:JSON" → все объекты внутри
const pages = new Map<string, unknown[]>();
const parts = fs.readFileSync(input, "utf8").split(/\n=====PAGE (\S+) (\d+)\n/);
for (let i = 1; i < parts.length; i += 3) {
  const [page, status, body] = [parts[i], parts[i + 1], parts[i + 2]];
  if (status !== "200") throw new Error(`Страница ${page} выгружена с ошибкой ${status}`);
  const values: unknown[] = [];
  for (const line of body.split("\n")) {
    const m = /^[0-9a-f]+:(.*)$/s.exec(line);
    if (!m) continue;
    try {
      values.push(JSON.parse(m[1]));
    } catch {
      // служебные строки RSC (ссылки на чанки и т. п.)
    }
  }
  pages.set(page, values);
}

/** Все объекты на странице, у которых есть поле key (обход в глубину) */
function collect(page: string, test: (o: Rec) => boolean): Rec[] {
  const found: Rec[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (test(v as Rec)) found.push(v as Rec);
    Object.values(v).forEach(walk);
  };
  walk(pages.get(page) ?? []);
  return found;
}
const arraysOf = (page: string, key: string) =>
  collect(page, (o) => Array.isArray(o[key])).flatMap((o) => o[key] as Rec[]);
function uniqueById<T extends { id: number }>(items: T[]): T[] {
  return [...new Map(items.map((x) => [x.id, x])).values()];
}

const lists = uniqueById(arraysOf("/money", "lists") as unknown as { id: number; name: string; icon: string }[]);
const tasks = uniqueById(
  [...arraysOf("/smart/all", "tasks"), ...arraysOf("/smart/completed", "tasks")] as unknown as ExportedTask[],
);
const entries = uniqueById(
  arraysOf("/money", "entries") as unknown as { id: number; amountCents: number; date: string; note: string | null }[],
);
const goals = uniqueById(
  collect("/money", (o) => typeof o.targetCents === "number" && typeof o.id === "number") as unknown as {
    id: number;
    title: string;
    targetCents: number;
    period: string | null;
    startDate: string | null;
    endDate: string | null;
  }[],
);
const notify = collect("/settings", (o) => typeof o.timezone === "string" && typeof o.digestTime === "string")[0];
const currency = collect("/settings", (o) => typeof o.value === "string" && /^[A-Z]{3}$/.test(o.value as string))[0]
  ?.value as string | undefined;
const inboxListId = collect("/smart/all", (o) => typeof o.inboxId === "number")[0]?.inboxId as number | undefined;

if (!lists.length || !tasks.length) throw new Error("В выгрузке не нашлось списков или задач — проверьте файл.");

// ── запись: новая база со всеми миграциями
process.env.DATABASE_PATH = outFile;
const { getDb, schema } = await import("@/shared/db/client");
const { normalizeRecurrence, serializeRecurrence } = await import("@/features/recurrence/rule");
const db = getDb();
const now = Date.now();
const ts = (ms: number | null) => (ms == null ? null : new Date(ms));

db.transaction((tx) => {
  lists.forEach((l, i) => tx.insert(schema.lists).values({ id: l.id, name: l.name, icon: l.icon, sortOrder: i }).run());

  for (const t of tasks) {
    const recurrence = t.recurrence ? normalizeRecurrence(t.recurrence as never) : null;
    tx.insert(schema.tasks)
      .values({
        id: t.id,
        listId: t.listId,
        title: t.title,
        notes: t.notes,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        durationMinutes: t.durationMinutes ?? null,
        priority: t.priority,
        flagged: t.flagged,
        completedAt: ts(t.completedAt),
        recurrence: t.dueDate ? serializeRecurrence(recurrence) : null,
        earlyReminders: t.earlyReminders?.length ? JSON.stringify(t.earlyReminders) : null,
        sortOrder: t.sortOrder,
      })
      .run();
    t.subtasks.forEach((s, i) =>
      tx.insert(schema.tasks)
        .values({ id: s.id, listId: t.listId, parentId: t.id, title: s.title, completedAt: ts(s.completedAt), sortOrder: i })
        .run(),
    );
    // Счётчик выполнений важен для повторов «N раз»; точные даты в выгрузке не видны
    for (let i = 0; i < t.completionCount; i++) {
      tx.insert(schema.taskCompletions)
        .values({ taskId: t.id, dueDate: null, completedAt: new Date(t.lastCompletedAt ?? now) })
        .run();
    }
  }

  for (const e of entries) tx.insert(schema.moneyEntries).values(e).run();
  for (const g of goals) tx.insert(schema.moneyGoals).values(g).run();

  const settings: Rec = {
    ...(notify && {
      timezone: notify.timezone,
      digestTime: notify.digestTime,
      digestEnabled: notify.digestEnabled,
      eveningTime: notify.eveningTime,
      eveningEnabled: notify.eveningEnabled,
    }),
    ...(currency && { currency }),
    ...(inboxListId != null && { inboxListId }),
  };
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) tx.insert(schema.settings).values({ key, value: JSON.stringify(value) }).run();
  }
});

// Один файл без -wal/-shm — его проще перенести на сервер
const sqlite = (db as unknown as { $client: import("better-sqlite3").Database }).$client;
sqlite.pragma("wal_checkpoint(TRUNCATE)");
sqlite.pragma("journal_mode = DELETE");
sqlite.close();

const subtaskCount = tasks.reduce((n, t) => n + t.subtasks.length, 0);
console.log(`✓ ${outFile}
  списков: ${lists.length}
  задач: ${tasks.length} (с повтором: ${tasks.filter((t) => t.recurrence).length}, выполненных: ${tasks.filter((t) => t.completedAt).length}), подзадач: ${subtaskCount}
  записей о деньгах: ${entries.length}, целей: ${goals.length}
  настройки: ${notify ? `${notify.timezone}, утро ${notify.digestTime}, вечер ${notify.eveningTime}` : "не найдены"}${currency ? `, ${currency}` : ""}`);
