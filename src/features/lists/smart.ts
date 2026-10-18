import { CalendarCheck, CalendarDays, CheckCheck, Flag, Layers, type LucideIcon } from "lucide-react";
import type { SmartListKind } from "@/features/tasks/model";

export const SMART_LIST_META: Record<SmartListKind, { title: string; icon: LucideIcon; empty: string }> = {
  today: { title: "Сегодня", icon: CalendarCheck, empty: "На сегодня задач нет" },
  scheduled: { title: "Запланированные", icon: CalendarDays, empty: "Нет задач с датой" },
  all: { title: "Все", icon: Layers, empty: "Задач пока нет" },
  flagged: { title: "С флажком", icon: Flag, empty: "Нет задач с флажком" },
  completed: { title: "Выполненные", icon: CheckCheck, empty: "Пока ничего не выполнено" },
};
