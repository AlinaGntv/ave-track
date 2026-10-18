import { notFound } from "next/navigation";
import { getInboxListId, getLists } from "@/features/lists/server";
import { SMART_LIST_META } from "@/features/lists/smart";
import { getSettings } from "@/features/settings/server";
import { TaskListView } from "@/features/tasks/components/TaskListView";
import { isSmartListKind, matchesView, type TaskView } from "@/features/tasks/model";
import { getCompletedTasks, getOpenTasks } from "@/features/tasks/server";
import { todayIn } from "@/shared/lib/dates";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export default async function SmartListPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isSmartListKind(kind)) notFound();

  const today = todayIn(getSettings().timezone);
  const view: TaskView = { type: "smart", kind };
  const tasks =
    kind === "completed"
      ? getCompletedTasks()
      : getOpenTasks().filter((t) => matchesView(t, view, today));
  const meta = SMART_LIST_META[kind];

  return (
    <>
      <ScreenHeader back={{ href: "/", label: "Списки" }} title={meta.title} />
      <TaskListView
        view={view}
        tasks={tasks}
        today={today}
        lists={getLists()}
        inboxId={getInboxListId()}
        emptyText={meta.empty}
      />
    </>
  );
}
