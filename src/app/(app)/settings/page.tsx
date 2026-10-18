import { LogOut } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { CurrencySelect } from "@/features/settings/components/CurrencySelect";
import { NotificationSettings } from "@/features/settings/components/NotificationSettings";
import { getTelegramConfig } from "@/features/telegram/config";
import { listTimeZones } from "@/shared/lib/dates";
import { ThemeSwitch } from "@/features/settings/components/ThemeSwitch";
import { getSettings } from "@/features/settings/server";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";

export default function SettingsPage() {
  const settings = getSettings();
  return (
    <>
      <ScreenHeader caption="AveTrack" title="Настройки" />

      <SectionTitle title="Оформление" />
      <div className="px-6">
        <ThemeSwitch />
      </div>

      <SectionTitle title="Деньги" />
      <CurrencySelect value={settings.currency} />

      <SectionTitle title="Уведомления" />
      <NotificationSettings
        values={{
          timezone: settings.timezone,
          digestTime: settings.digestTime,
          digestEnabled: settings.digestEnabled,
          eveningTime: settings.eveningTime,
          eveningEnabled: settings.eveningEnabled,
        }}
        timezones={listTimeZones()}
        telegramConfigured={getTelegramConfig() != null}
      />

      <form action={logout} className="px-6 pt-10">
        <Pressable
          type="submit"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-surface font-semibold text-fg"
        >
          <LogOut size={18} />
          Выйти
        </Pressable>
      </form>
    </>
  );
}
