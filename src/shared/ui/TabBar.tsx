"use client";

import { motion } from "framer-motion";
import { MoreHorizontal, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActive, navItems, QUICK_ADD_EVENT, type NavItem } from "@/shared/navigation/nav";
import { cn } from "@/shared/lib/cn";
import { spring } from "./motion";
import { Pressable, PressableLink } from "./Pressable";

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <PressableLink
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className="relative flex h-[60px] min-w-0 flex-col items-center justify-center gap-0.5"
    >
      <Icon
        size={21}
        strokeWidth={active ? 2.3 : 1.9}
        className={cn("transition-colors duration-200", active ? "text-fg" : "text-muted")}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
      <span className={cn("max-w-full truncate px-0.5 text-[9px] leading-3", active ? "font-bold text-fg" : "font-medium text-muted")}>{item.label}</span>
      {active && (
        <motion.span
          layoutId="tab-dot"
          transition={spring.smooth}
          className="absolute bottom-1.5 h-1 w-1 rounded-full bg-fg"
        />
      )}
    </PressableLink>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = ["/", "/today", "/calendar", "/money"];
  const primaryItems = primary.map((href) => navItems.find((item) => item.href === href)).filter((item): item is NavItem => Boolean(item));
  const moreItems = navItems.filter((item) => !primary.includes(item.href));

  return (
    <>
      {moreOpen && <>
        <button aria-label="Закрыть меню разделов" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-40 bg-black/20 lg:hidden" />
        <div className="fixed inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[24px] border border-line bg-surface p-2 shadow-soft lg:hidden">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-2">Все разделы</p>
          <div className="grid grid-cols-2 gap-1">{moreItems.map((item) => { const Icon = item.icon; const active = isActive(item, pathname); return <PressableLink key={item.href} href={item.href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold", active ? "bg-ink text-on-ink" : "text-fg hover:bg-bg")}><Icon size={18} /><span className="truncate">{item.label}</span></PressableLink>; })}</div>
        </div>
      </>}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/90 backdrop-blur-xl lg:hidden md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[min(28rem,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-[28px] md:border md:pb-0 md:shadow-soft">
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-[repeat(2,minmax(0,1fr))_52px_repeat(3,minmax(0,1fr))] items-center px-2">
          {primaryItems.slice(0, 2).map((item) => <Tab key={item.href} item={item} active={isActive(item, pathname)} />)}
          <div className="flex justify-center">
          <Pressable
            aria-label="Добавить"
            onClick={() => window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT))}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-on-ink ring-4 ring-surface-2 shadow-soft"
          >
            <Plus size={24} strokeWidth={2.2} />
          </Pressable>
          </div>
          {primaryItems.slice(2).map((item) => <Tab key={item.href} item={item} active={isActive(item, pathname)} />)}
          <Pressable aria-label="Все разделы" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={cn("relative flex h-14 flex-col items-center justify-center", moreOpen || moreItems.some((item) => isActive(item, pathname)) ? "text-fg" : "text-muted")}>
            <MoreHorizontal size={23} strokeWidth={2} />
            <span className="mt-0.5 text-[9px] font-semibold">Ещё</span>
          </Pressable>
        </div>
      </nav>
    </>
  );
}
