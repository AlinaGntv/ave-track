import { ListsSection } from "@/features/lists/components/ListsSection";
import { SmartListTiles } from "@/features/lists/components/SmartListTiles";
import { getInboxListId, getLists } from "@/features/lists/server";
import { HomeMoneyHero } from "@/features/money/components/HomeMoneyHero";
import { getMoneyOverview, getRecentNotes } from "@/features/money/server";
import { getSettings } from "@/features/settings/server";
import { countSmartLists } from "@/features/tasks/model";
import { SendReportButton } from "@/features/telegram/components/SendReportButton";
import { getTelegramConfig } from "@/features/telegram/config";
import { countCompleted, getOpenTasks } from "@/features/tasks/server";
import { formatDate, todayIn } from "@/shared/lib/dates";
import { RefreshButton } from "@/shared/ui/RefreshButton";
import { SectionTitle } from "@/shared/ui/ScreenHeader";

export default function HomePage() {
  const settings = getSettings();
  const today = todayIn(settings.timezone);
  const counts = countSmartLists(getOpenTasks(), today);
  const money = getMoneyOverview(today);
  // В шапке — ближайшая недостигнутая цель
  const goal = money.goals.find((g) => !g.progress.achieved) ?? money.goals[0];

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between gap-3 pr-4 pb-3 pl-6">
        <p className="text-sm font-medium text-muted-2">{formatDate(today, "d MMMM, EEEE")}</p>
        <div className="flex items-center">
          <RefreshButton size="sm" />
          {getTelegramConfig() && <SendReportButton />}
        </div>
      </div>
      <HomeMoneyHero
        totals={money.totals}
        goal={goal}
        currency={settings.currency}
        today={today}
        recentNotes={getRecentNotes()}
      />

      <SectionTitle title="Задачи" />
      <SmartListTiles counts={counts} completed={countCompleted()} />

      <ListsSection lists={getLists()} inboxId={getInboxListId()} />
    </div>
  );
}
