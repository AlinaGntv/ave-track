import { getLeadOutreachDays, getLeads } from "@/features/leads/server";
import { LeadTrackerScreen } from "@/features/leads/components/LeadTrackerScreen";
import { getSettings } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";

export default function LeadsPage() {
  const settings = getSettings();
  return <LeadTrackerScreen leads={getLeads()} outreachDays={getLeadOutreachDays()} today={todayIn(settings.timezone)} currency={settings.currency} />;
}
