import { GoalsScreen } from "@/features/goals/components/GoalsScreen";
import { getPersonalGoals, getPersonalWishes } from "@/features/goals/server";
import { getSettings } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";

export default function GoalsPage() {
  const settings = getSettings();
  return <GoalsScreen goals={getPersonalGoals()} wishes={getPersonalWishes()} today={todayIn(settings.timezone)} currency={settings.currency} />;
}
