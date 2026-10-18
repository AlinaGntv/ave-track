import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/shared/db/client";
import { isValidTimeZone } from "@/shared/lib/dates";

const settingsSchema = z.object({
  timezone: z.string().refine(isValidTimeZone).default("Europe/Amsterdam"),
  /** Время утренней рассылки, "HH:mm" */
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("08:00"),
  digestEnabled: z.boolean().default(true),
  /** Вечерняя сводка: невыполненное за день → задачи на завтра → доходы за месяц */
  eveningTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("18:00"),
  eveningEnabled: z.boolean().default(true),
  currency: z.string().length(3).default("EUR"),
  inboxListId: z.number().int().nullable().default(null),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export function getSettings(): Settings {
  const rows = getDb().select().from(schema.settings).all();
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.value);
    } catch {
      // битое значение — будет заменено значением по умолчанию
    }
  }
  // Каждое поле валидируется отдельно: одно битое значение не ломает остальные
  const result = {} as Record<string, unknown>;
  for (const [key, field] of Object.entries(settingsSchema.shape)) {
    const parsed = field.safeParse(raw[key]);
    result[key] = parsed.success ? parsed.data : field.parse(undefined);
  }
  return result as Settings;
}

export function setSetting<K extends SettingKey>(key: K, value: Settings[K]): void {
  const parsed = settingsSchema.shape[key].parse(value);
  const json = JSON.stringify(parsed);
  getDb()
    .insert(schema.settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: json } })
    .run();
}

export function deleteSetting(key: SettingKey): void {
  getDb().delete(schema.settings).where(eq(schema.settings.key, key)).run();
}
