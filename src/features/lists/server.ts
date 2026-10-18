import { and, asc, count, eq, isNull, max } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";
import { getSettings, setSetting } from "@/features/settings/server";

export const INBOX_NAME = "Входящие";

const l = schema.lists;
const t = schema.tasks;

export type ListItem = { id: number; name: string; icon: string; openCount: number };

/** id списка «Входящие»; создаёт его, если он ещё не существует или был удалён. */
export function getInboxListId(): number {
  const db = getDb();
  const { inboxListId } = getSettings();
  if (inboxListId != null) {
    const existing = db.select({ id: l.id }).from(l).where(eq(l.id, inboxListId)).get();
    if (existing) return existing.id;
  }
  const created = db
    .insert(l)
    .values({ name: INBOX_NAME, icon: "inbox", sortOrder: 0 })
    .returning({ id: l.id })
    .get();
  setSetting("inboxListId", created.id);
  return created.id;
}

/** Списки по порядку со счётчиком невыполненных задач верхнего уровня. */
export function getLists(): ListItem[] {
  getInboxListId();
  const db = getDb();
  const counts = new Map(
    db
      .select({ listId: t.listId, n: count() })
      .from(t)
      .where(and(isNull(t.parentId), isNull(t.completedAt)))
      .groupBy(t.listId)
      .all()
      .map((r) => [r.listId, r.n]),
  );
  return db
    .select({ id: l.id, name: l.name, icon: l.icon })
    .from(l)
    .orderBy(asc(l.sortOrder), asc(l.id))
    .all()
    .map((row) => ({ ...row, openCount: counts.get(row.id) ?? 0 }));
}

export function getList(id: number): ListItem | null {
  return getLists().find((list) => list.id === id) ?? null;
}

export function saveList(id: number | null, data: { name: string; icon: string }): number {
  const db = getDb();
  if (id != null) {
    db.update(l).set(data).where(eq(l.id, id)).run();
    return id;
  }
  const last = db.select({ m: max(l.sortOrder) }).from(l).get()?.m ?? 0;
  return db
    .insert(l)
    .values({ ...data, sortOrder: last + 1 })
    .returning({ id: l.id })
    .get().id;
}

/** Удаляет список вместе с задачами. «Входящие» удалить нельзя. */
export function deleteList(id: number): void {
  if (id === getInboxListId()) throw new Error("Нельзя удалить «Входящие»");
  getDb().delete(l).where(eq(l.id, id)).run();
}
