import { CalendarDays, House, Settings, Wallet, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Какие пути подсвечивают этот пункт (по умолчанию — href и вложенные) */
  match?: (pathname: string) => boolean;
};

/**
 * Реестр разделов. Новый модуль = новая запись здесь.
 * Таб-бар делит пункты пополам и ставит кнопку «+» посередине.
 */
export const navItems: NavItem[] = [
  { href: "/", label: "Главная", icon: House,   match: (p) => p === "/" || p.startsWith("/lists/") || p.startsWith("/smart/"),
  },
  { href: "/today", label: "Сегодня", icon: CalendarDays },
  { href: "/money", label: "Деньги", icon: Wallet },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Событие кнопки «+» в таб-баре — экраны подписываются и открывают свой sheet создания. */
export const QUICK_ADD_EVENT = "avetrack:quick-add";
