import type { ReactNode } from "react";
import { getInboxListId, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { TaskEditorProvider } from "@/features/tasks/components/TaskEditorProvider";
import { countSmartLists } from "@/features/tasks/model";
import { countCompleted, getOpenTasks } from "@/features/tasks/server";
import { formatDate, todayIn } from "@/shared/lib/dates";
import { AutoRefresh } from "@/shared/ui/RefreshButton";
import { TabBar } from "@/shared/ui/TabBar";
import { ContentWidth } from "./_shell/ContentWidth";
import { Sidebar } from "./_shell/Sidebar";

// Все экраны читают SQLite на каждый запрос — статическая генерация не нужна
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  const allLists = getLists();
  const lists = allLists.map(({ id, name, icon }) => ({ id, name, icon }));
  const today = todayIn(getSettings().timezone);

  return (
    <TaskEditorProvider lists={lists} inboxId={getInboxListId()} today={today}>
      {/* Компьютер: боковая панель слева; телефон — вкладки снизу */}
      <Sidebar
        dateLabel={formatDate(today, "EEEE, d MMMM")}
        smartCounts={countSmartLists(getOpenTasks(), today)}
        completedCount={countCompleted()}
        lists={allLists}
      />
      <main className="pt-safe mx-auto min-h-dvh max-w-md pb-[calc(96px+env(safe-area-inset-bottom))] md:bg-bg md:pb-28 md:shadow-soft lg:mr-0 lg:ml-64 lg:max-w-none lg:pb-12 lg:shadow-none">
        <ContentWidth>{children}</ContentWidth>
      </main>
      <TabBar />
      <AutoRefresh />
    </TaskEditorProvider>
  );
}
