// Бэкап базы: согласованная копия через SQLite online backup API (безопасно при работающих
// web и worker в WAL-режиме — простой cp мог бы скопировать файл без незаписанного WAL).
// Хранит последние BACKUP_KEEP копий (по умолчанию 14).
//
//   node --env-file-if-exists=.env scripts/backup.mjs     (или npm run backup)
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.env.DATABASE_PATH ?? "./data/avetrack.db");
const dir = path.resolve(root, process.env.BACKUP_DIR ?? "./backups");
const keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14));

if (!fs.existsSync(source)) {
  console.error(`База не найдена: ${source}`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dir, `avetrack-${stamp}.db`);

const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(target);
} finally {
  db.close();
}

// Копия наследует WAL-режим; переводим её в обычный журнал, чтобы бэкап был одним файлом
// без -wal/-shm, и заодно проверяем, что она читается
const check = new Database(target);
check.pragma("journal_mode = DELETE");
const ok = check.pragma("quick_check", { simple: true });
const tasks = check.prepare("select count(*) as n from tasks").get().n;
check.close();
if (ok !== "ok") {
  console.error(`Копия повреждена (${ok}): ${target}`);
  process.exit(1);
}
console.log(`✓ ${target} (задач: ${tasks})`);

// Ротация: удаляем самые старые
const old = fs
  .readdirSync(dir)
  .filter((f) => /^avetrack-.*\.db$/.test(f))
  .sort()
  .slice(0, -keep);
for (const file of old) {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    fs.rmSync(path.join(dir, file + suffix), { force: true });
  }
  console.log(`  удалён старый бэкап ${file}`);
}
