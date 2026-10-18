import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

// Переживает HMR в dev-режиме Next.js
const globalForDb = globalThis as unknown as { __avetrackDb?: Db };

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Ошибки, при которых стоит повторить: web и worker стартуют одновременно на одной базе.
 * Drizzle читает список применённых миграций до BEGIN, и два процесса с отложенными
 * транзакциями упираются в SQLITE_BUSY (busy_timeout тут не спасает) или второй
 * пытается создать уже созданную таблицу.
 */
function isConcurrentStartError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${(error.cause as Error | undefined)?.message ?? ""}` : "";
  return /database is locked|SQLITE_BUSY|already exists/i.test(message);
}

function open(): Db {
  const file = path.resolve(process.env.DATABASE_PATH ?? "./data/avetrack.db");
  const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle"));
  fs.mkdirSync(path.dirname(file), { recursive: true });

  for (let attempt = 1; ; attempt++) {
    const sqlite = new Database(file);
    try {
      sqlite.pragma("busy_timeout = 5000");
      // web и worker пишут в один файл — WAL позволяет читать параллельно с записью
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("synchronous = NORMAL");
      sqlite.pragma("foreign_keys = ON");

      const db = drizzle(sqlite, { schema });
      migrate(db, { migrationsFolder });
      return db;
    } catch (error) {
      sqlite.close();
      if (attempt >= 10 || !isConcurrentStartError(error)) throw error;
      // Повтор увидит миграции, которые успел применить другой процесс
      sleepSync(50 * attempt + Math.random() * 100);
    }
  }
}

/** Ленивое подключение: БД открывается при первом обращении, а не при импорте (важно для next build). */
export function getDb(): Db {
  globalForDb.__avetrackDb ??= open();
  return globalForDb.__avetrackDb;
}

export { schema };
