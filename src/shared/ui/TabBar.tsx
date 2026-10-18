"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
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
      className="relative flex h-14 min-w-11 flex-1 flex-col items-center justify-center"
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.3 : 1.9}
        className={cn("transition-colors duration-200", active ? "text-fg" : "text-muted")}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
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
  const mid = Math.ceil(navItems.length / 2);
  const render = (items: NavItem[]) =>
    items.map((item) => <Tab key={item.href} item={item} active={isActive(item, pathname)} />);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/85 backdrop-blur-xl md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[calc(28rem-2rem)] md:-translate-x-1/2 md:rounded-[28px] md:border md:pb-0 md:shadow-soft">
      <div className="mx-auto flex h-[72px] max-w-md items-center px-4">
        {render(navItems.slice(0, mid))}
        <div className="flex flex-1 justify-center">
          <Pressable
            aria-label="Добавить"
            onClick={() => window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT))}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-on-ink ring-[5px] ring-surface-2 shadow-soft"
          >
            <Plus size={24} strokeWidth={2.2} />
          </Pressable>
        </div>
        {render(navItems.slice(mid))}
      </div>
    </nav>
  );
}
