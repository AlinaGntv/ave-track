// Применяет миграции из ./drizzle. Те же миграции применяются автоматически
// при первом подключении к БД, скрипт нужен для деплоя и ручной проверки.
import { getDb } from "../src/shared/db/client";
import { getInboxListId } from "../src/features/lists/server";

getDb();
getInboxListId();
console.log("✓ Миграции применены:", process.env.DATABASE_PATH ?? "./data/avetrack.db");
