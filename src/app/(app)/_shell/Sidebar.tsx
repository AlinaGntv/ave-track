"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { listIcon } from "@/features/lists/icons";
import type { ListItem } from "@/features/lists/server";
import { SMART_LIST_META } from "@/features/lists/smart";
import { SMART_LISTS, type SmartCounts } from "@/features/tasks/model";
import { cn } from "@/shared/lib/cn";
import { isActive, navItems, QUICK_ADD_EVENT } from "@/shared/navigation/nav";
import { spring } from "@/shared/ui/motion";
import { Pressable, PressableLink } from "@/shared/ui/Pressable";

function SideLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <PressableLink
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-[12px] px-3 text-[14px] font-semibold transition-colors",
        active ? "text-fg" : "text-muted-2 hover:bg-bg/60 hover:text-fg",
      )}
    >
      {active && (
        <motion.span layoutId="sidebar-active" transition={spring.smooth} className="absolute inset-0 rounded-[12px] bg-bg shadow-soft" />
      )}
      <span className="relative flex w-5 justify-center">{icon}</span>
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && <span className="relative text-[12px] font-semibold text-muted tabular-nums">{count}</span>}
    </PressableLink>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-5 pb-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">{children}</p>;
}

/**
 * Боковая панель на компьютере (≥1024px) вместо нижних вкладок: разделы, «Новая задача»,
 * умные списки и списки пользователя со счётчиками.
 */
export function Sidebar({
  dateLabel,
  smartCounts,
  completedCount,
  lists,
}: {
  dateLabel: string;
  smartCounts: SmartCounts;
  completedCount: number;
  lists: ListItem[];
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="px-6 pt-7 pb-4">
        <p className="text-[20px] font-bold tracking-tight">AveTrack</p>
        <p className="text-[13px] font-medium text-muted-2 first-letter:uppercase">{dateLabel}</p>
      </div>

      <div className="px-4">
        <Pressable
          onClick={() => window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT))}
          className="flex h-11 w-full items-center gap-2 rounded-[14px] bg-ink px-4 text-[14px] font-semibold text-on-ink shadow-soft"
        >
          <Plus size={18} strokeWidth={2.4} />
          <span className="flex-1 text-left">Новая задача</span>
          <kbd className="rounded-md bg-on-ink/15 px-1.5 text-[11px] font-semibold">N</kbd>
        </Pressable>
      </div>

      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          // «Главная» подсвечивается только на самой главной: списки ниже — отдельными пунктами
          const active = item.href === "/" ? pathname === "/" : isActive(item, pathname);
          return <SideLink key={item.href} href={item.href} active={active} icon={<Icon size={17} />} label={item.label} />;
        })}

        <SectionLabel>Умные списки</SectionLabel>
        {SMART_LISTS.map((kind) => {
          const { title, icon: Icon } = SMART_LIST_META[kind];
          const count = kind === "completed" ? completedCount : smartCounts[kind];
          return (
            <SideLink
              key={kind}
              href={`/smart/${kind}`}
              active={pathname === `/smart/${kind}`}
              icon={<Icon size={16} />}
              label={title}
              count={kind === "completed" ? undefined : count}
            />
          );
        })}

        <SectionLabel>Мои списки</SectionLabel>
        {lists.map((list) => {
          const Icon = listIcon(list.icon);
          return (
            <SideLink
              key={list.id}
              href={`/lists/${list.id}`}
              active={pathname === `/lists/${list.id}`}
              icon={<Icon size={16} />}
              label={list.name}
              count={list.openCount}
            />
          );
        })}
      </nav>
    </aside>
  );
}
