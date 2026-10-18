import { notFound } from "next/navigation";
import { ListHeaderActions } from "@/features/lists/components/ListHeaderActions";
import { getInboxListId, getList, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { TaskListView } from "@/features/tasks/components/TaskListView";
import { getCompletedTasks, getOpenTasks } from "@/features/tasks/server";
import { todayIn } from "@/shared/lib/dates";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const list = Number.isInteger(id) ? getList(id) : null;
  if (!list) notFound();

  const inboxId = getInboxListId();
  const tasks = [
    ...getOpenTasks().filter((t) => t.listId === id),
    ...getCompletedTasks({ listId: id, limit: 200 }),
  ];

  return (
    <>
      <ScreenHeader
        back={{ href: "/", label: "Списки" }}
        title={list.name}
        right={<ListHeaderActions list={list} isInbox={id === inboxId} />}
      />
      <TaskListView
        view={{ type: "list", listId: id }}
        tasks={tasks}
        today={todayIn(getSettings().timezone)}
        lists={getLists()}
        inboxId={inboxId}
        emptyText="В этом списке пока пусто"
      />
    </>
  );
}
