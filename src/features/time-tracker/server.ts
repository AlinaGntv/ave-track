import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";

const e = schema.timeEntries;
const s = schema.timeTrackerSession;

export type TimeEntry = { id: number; name: string; durationMs: number; date: number; sourceId: string | null };
export type ActiveTimer = { name: string; startedAt: number };

export function getTimeTrackerData(): { entries: TimeEntry[]; activeTimer: ActiveTimer | null } {
  const db = getDb();
  const entries = db
    .select()
    .from(e)
    .orderBy(desc(e.date), desc(e.id))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      durationMs: row.durationMs,
      date: row.date.getTime(),
      sourceId: row.sourceId,
    }));
  const session = db.select().from(s).where(eq(s.id, 1)).get();
  return {
    entries,
    activeTimer: session ? { name: session.name, startedAt: session.startedAt.getTime() } : null,
  };
}

export function startTimer(name: string): ActiveTimer {
  const startedAt = Date.now();
  getDb()
    .insert(s)
    .values({ id: 1, name, startedAt: new Date(startedAt) })
    .onConflictDoUpdate({ target: s.id, set: { name, startedAt: new Date(startedAt) } })
    .run();
  return { name, startedAt };
}

export function stopTimer(): void {
  const db = getDb();
  db.transaction((tx) => {
    const session = tx.select().from(s).where(eq(s.id, 1)).get();
    if (!session) return;
    const stoppedAt = Date.now();
    const durationMs = Math.max(0, stoppedAt - session.startedAt.getTime());
    tx.insert(e).values({ name: session.name, durationMs, date: new Date(stoppedAt), sourceId: null }).run();
    tx.delete(s).where(eq(s.id, 1)).run();
  });
}

export function addTimeEntry(input: { name: string; durationMs: number; date: number }): void {
  getDb()
    .insert(e)
    .values({ name: input.name, durationMs: input.durationMs, date: new Date(input.date), sourceId: null })
    .run();
}

export function deleteTimeEntry(id: number): void {
  getDb().delete(e).where(eq(e.id, id)).run();
}

export function clearTimeEntries(): void {
  getDb().delete(e).run();
}

export function importTimeEntries(
  records: Array<{ id: string; name: string; durationMs: number; date: number }>,
): { imported: number; skipped: number } {
  const db = getDb();
  return db.transaction((tx) => {
    let imported = 0;
    for (const record of records) {
      const sourceId = `timeTrackerDataV2:${record.id}`;
      const existing = tx.select({ id: e.id }).from(e).where(eq(e.sourceId, sourceId)).get();
      if (existing) continue;
      tx.insert(e)
        .values({
          name: record.name,
          durationMs: record.durationMs,
          date: new Date(record.date),
          sourceId,
        })
        .run();
      imported++;
    }
    return { imported, skipped: records.length - imported };
  });
}
