import { getInboxListId, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { TodayScreen } from "@/features/tasks/components/TodayScreen";
import { getCompletedTasks, getOpenTasks } from "@/features/tasks/server";
import { shiftDate, todayIn } from "@/shared/lib/dates";

export default function TodayPage() {
  const today = todayIn(getSettings().timezone);
  // Лента показывает ±3 дня: открытые задачи до конца недели + выполненные в этом окне
  const from = shiftDate(today, -3);
  const to = shiftDate(today, 3);
  const tasks = [
    ...getOpenTasks().filter((t) => t.dueDate != null && t.dueDate <= to),
    ...getCompletedTasks({ dueFrom: from, dueTo: to }),
  ];

  return <TodayScreen today={today} tasks={tasks} lists={getLists()} inboxId={getInboxListId()} />;
}
