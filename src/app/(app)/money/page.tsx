import { MoneyScreen } from "@/features/money/components/MoneyScreen";
import { getEntries, getGoals, getRecentNotes } from "@/features/money/server";
import { getSettings } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";

export default function MoneyPage() {
  const settings = getSettings();
  return (
    <MoneyScreen
      entries={getEntries()}
      goals={getGoals()}
      currency={settings.currency}
      today={todayIn(settings.timezone)}
      recentNotes={getRecentNotes()}
    />
  );
}
