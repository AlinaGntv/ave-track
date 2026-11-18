import { getSettings } from "@/features/settings/server";
import { TimeTrackerScreen } from "@/features/time-tracker/components/TimeTrackerScreen";
import { getTimeTrackerData } from "@/features/time-tracker/server";
import { todayIn } from "@/shared/lib/dates";

export default function TimeTrackerPage() {
  const settings = getSettings();
  const data = getTimeTrackerData();
  return <TimeTrackerScreen {...data} today={todayIn(settings.timezone)} timezone={settings.timezone} />;
}
