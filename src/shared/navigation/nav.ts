import { CalendarCheck, CalendarRange, House, Settings, Wallet, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Какие пути подсвечивают этот пункт (по умолчанию — href и вложенные) */
  match?: (pathname: string) => boolean;
  /** Показывать во вкладках на телефоне (на компьютере в боковой панели видны все) */
  tab?: boolean;
};

/**
 * Реестр разделов. Новый модуль = новая запись здесь.
 * Таб-бар (телефон) берёт пункты с tab: true, делит пополам и ставит «+» посередине;
 * боковая панель (компьютер) показывает все пункты.
 */
export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Главная",
    icon: House,
    match: (p) => p === "/" || p.startsWith("/lists/") || p.startsWith("/smart/"),
    tab: true,
  },
  { href: "/today", label: "Сегодня", icon: CalendarCheck, tab: true },
  { href: "/calendar", label: "Календарь", icon: CalendarRange, tab: true },
  { href: "/money", label: "Деньги", icon: Wallet, tab: true },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export const tabItems = navItems.filter((item) => item.tab);

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Событие кнопки «+» в таб-баре — экраны подписываются и открывают свой sheet создания. */
export const QUICK_ADD_EVENT = "avetrack:quick-add";
