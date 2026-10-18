import type { ReactNode } from "react";
import { getInboxListId, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { TaskEditorProvider } from "@/features/tasks/components/TaskEditorProvider";
import { todayIn } from "@/shared/lib/dates";
import { TabBar } from "@/shared/ui/TabBar";

// Все экраны читают SQLite на каждый запрос — статическая генерация не нужна
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  const lists = getLists().map(({ id, name, icon }) => ({ id, name, icon }));
  const today = todayIn(getSettings().timezone);

  return (
    <TaskEditorProvider lists={lists} inboxId={getInboxListId()} today={today}>
      <main className="pt-safe mx-auto min-h-dvh max-w-md pb-[calc(96px+env(safe-area-inset-bottom))] md:bg-bg md:pb-28 md:shadow-soft">
        {children}
      </main>
      <TabBar />
    </TaskEditorProvider>
  );
}
