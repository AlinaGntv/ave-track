import { SportScreen } from "@/features/sport/components/SportScreen";
import { getSportData } from "@/features/sport/server";
import { getSettings } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";

export default function SportPage() {
  const { timezone } = getSettings();
  return <SportScreen data={getSportData()} today={todayIn(timezone)} />;
}
