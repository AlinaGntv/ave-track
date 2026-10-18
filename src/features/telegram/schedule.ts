// Чистые правила расписания worker'а. Время — локальное "HH:mm" в часовом поясе из настроек.

export function minutesOf(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Пора ли слать утреннюю сводку. Если worker был выключен в нужную минуту,
 * сводка «догоняет» в течение catchUpMin, но не приходит вечером как «утренняя».
 * Повторную отправку исключает отметка в sent_notifications, а не это правило.
 */
export function isDigestDue(now: string, digestTime: string, enabled: boolean, catchUpMin = 240): boolean {
  if (!enabled) return false;
  const late = minutesOf(now) - minutesOf(digestTime);
  return late >= 0 && late < catchUpMin;
}

/**
 * Пора ли напоминать о задаче со временем. Окно позволяет догнать напоминание
 * после короткого простоя worker'а, но не будить задачами, время которых давно прошло
 * (например, если задачу создали в 10:00 со временем 08:00).
 */
export function isReminderDue(dueTime: string, now: string, windowMin = 60): boolean {
  const late = minutesOf(now) - minutesOf(dueTime);
  return late >= 0 && late < windowMin;
}
