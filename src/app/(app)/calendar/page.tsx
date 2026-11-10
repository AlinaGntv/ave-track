import { CalendarScreen } from "@/features/calendar/components/CalendarScreen";
import { isCalendarView, visibleDays } from "@/features/calendar/model";
import { getInboxListId, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { getCompletedTasks, getOpenTasks } from "@/features/tasks/server";
import { todayIn } from "@/shared/lib/dates";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const { timezone } = getSettings();
  const today = todayIn(timezone);
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  // Без явного режима экран сам выберет: неделя на компьютере, 3 дня на телефоне
  const view = isCalendarView(params.view) ? params.view : null;
  const days = visibleDays(anchor, view ?? "week");

  // Открытые задачи — все (у повторяющихся считаются будущие вхождения), выполненные — за видимые дни
  const tasks = [
    ...getOpenTasks(),
    ...getCompletedTasks({ dueFrom: days[0], dueTo: days.at(-1), limit: 500 }),
  ];

  return (
    <CalendarScreen
      anchor={anchor}
      view={view}
      today={today}
      tasks={tasks}
      lists={getLists()}
      inboxId={getInboxListId()}
      timezone={timezone}
    />
  );
}
