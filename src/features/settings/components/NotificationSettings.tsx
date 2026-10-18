"use client";

import { Bell, ChevronsUpDown, Clock, Globe, Moon, Send } from "lucide-react";
import { startTransition, useOptimistic, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Pressable } from "@/shared/ui/Pressable";
import { Switch } from "@/shared/ui/Switch";
import { useToast } from "@/shared/ui/Toast";
import { sendTestMessageAction, setNotificationSettingsAction } from "../actions";

type Values = {
  timezone: string;
  digestTime: string;
  digestEnabled: boolean;
  eveningTime: string;
  eveningEnabled: boolean;
};

function Row({ icon: Icon, label, children }: { icon: typeof Bell; label: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-14 items-center gap-3 px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <Icon size={16} />
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {children}
    </div>
  );
}

export function NotificationSettings({
  values: serverValues,
  timezones,
  telegramConfigured,
}: {
  values: Values;
  timezones: string[];
  telegramConfigured: boolean;
}) {
  const [values, setOptimistic] = useOptimistic(serverValues, (state, patch: Partial<Values>) => ({
    ...state,
    ...patch,
  }));
  const [testing, setTesting] = useState(false);
  const toast = useToast();

  const save = (patch: Partial<Values>) =>
    startTransition(async () => {
      setOptimistic(patch);
      try {
        await setNotificationSettingsAction(patch);
      } catch {
        toast.show({ message: "Не удалось сохранить настройки" });
      }
    });

  return (
    <div className="mx-6">
      <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
        <Row icon={Bell} label="Утренняя сводка">
          <Switch label="Утренняя сводка" checked={values.digestEnabled} onChange={(digestEnabled) => save({ digestEnabled })} />
        </Row>
        <Row icon={Clock} label="Время сводки">
          <input
            type="time"
            value={values.digestTime}
            disabled={!values.digestEnabled}
            onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && save({ digestTime: e.target.value })}
            aria-label="Время сводки"
            className="h-9 rounded-full bg-bg px-3 text-base font-semibold outline-none disabled:opacity-40"
          />
        </Row>
        <Row icon={Moon} label="Вечерняя сводка">
          <Switch
            label="Вечерняя сводка"
            checked={values.eveningEnabled}
            onChange={(eveningEnabled) => save({ eveningEnabled })}
          />
        </Row>
        <Row icon={Clock} label="Время вечерней">
          <input
            type="time"
            value={values.eveningTime}
            disabled={!values.eveningEnabled}
            onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && save({ eveningTime: e.target.value })}
            aria-label="Время вечерней сводки"
            className="h-9 rounded-full bg-bg px-3 text-base font-semibold outline-none disabled:opacity-40"
          />
        </Row>
        <label className="block">
          <Row icon={Globe} label="Часовой пояс">
            <span className="flex max-w-[50%] items-center gap-1 truncate text-[14px] font-semibold text-muted-2">
              <span className="truncate">{values.timezone.replace(/_/g, " ")}</span>
              <ChevronsUpDown size={15} className="shrink-0" />
            </span>
            <select
              value={values.timezone}
              onChange={(e) => save({ timezone: e.target.value })}
              aria-label="Часовой пояс"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Row>
        </label>
      </div>
      <p className="px-2 pt-2 text-[12px] text-muted-2">
        Вечером приходят три сообщения подряд: что не сделано сегодня, задачи на завтра и доходы за месяц.
        Время — по выбранному часовому поясу.
      </p>

      <div className="mt-3 rounded-[20px] bg-surface p-4">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <span className={cn("h-2 w-2 rounded-full", telegramConfigured ? "bg-fg" : "border border-muted")} />
          {telegramConfigured ? "Telegram-бот подключён" : "Telegram-бот не настроен"}
        </p>
        <p className="mt-1 text-[13px] text-muted-2">
          {telegramConfigured
            ? "Сводка и напоминания приходят, пока запущен worker (npm run worker)."
            : "Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env и перезапустите приложение и worker."}
        </p>
        {telegramConfigured && (
          <Pressable
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              const result = await sendTestMessageAction();
              setTesting(false);
              toast.show({ message: result.ok ? "Сообщение отправлено — проверьте Telegram" : `Ошибка: ${result.error}` });
            }}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-bg text-[14px] font-semibold disabled:opacity-50"
          >
            <Send size={16} />
            {testing ? "Отправляем…" : "Отправить тестовое сообщение"}
          </Pressable>
        )}
      </div>
    </div>
  );
}
