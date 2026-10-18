import { ChevronRight } from "lucide-react";
import type { SmartCounts, SmartListKind } from "@/features/tasks/model";
import { cn } from "@/shared/lib/cn";
import { PressableLink } from "@/shared/ui/Pressable";
import { Waves } from "@/shared/ui/Waves";
import { SMART_LIST_META } from "../smart";

function Tile({ kind, count, primary }: { kind: SmartListKind; count: number; primary?: boolean }) {
  const { title, icon: Icon } = SMART_LIST_META[kind];
  return (
    <PressableLink
      href={`/smart/${kind}`}
      className={cn(
        "relative flex h-[118px] flex-col justify-between overflow-hidden rounded-[26px] p-4",
        primary ? "bg-ink text-on-ink shadow-soft" : "bg-surface text-fg",
      )}
    >
      {primary && <Waves className="text-on-ink opacity-15" />}
      <div className="relative flex items-start justify-between">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            primary ? "bg-on-ink text-ink" : "bg-card text-fg shadow-soft",
          )}
        >
          <Icon size={19} strokeWidth={2.1} />
        </span>
        <span className="text-[28px] leading-none font-bold tabular-nums">{count}</span>
      </div>
      <span className="relative text-[15px] font-bold">{title}</span>
    </PressableLink>
  );
}

/** Плитки умных списков на главной. «Сегодня» — тёмная карточка, как акцентная карточка в дизайне. */
export function SmartListTiles({ counts, completed }: { counts: SmartCounts; completed: number }) {
  const { icon: DoneIcon, title } = SMART_LIST_META.completed;
  return (
    <div className="px-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile kind="today" count={counts.today} primary />
        <Tile kind="scheduled" count={counts.scheduled} />
        <Tile kind="all" count={counts.all} />
        <Tile kind="flagged" count={counts.flagged} />
      </div>
      <PressableLink
        href="/smart/completed"
        className="mt-3 flex h-14 items-center gap-3 rounded-[20px] bg-surface px-4"
      >
        <DoneIcon size={19} />
        <span className="flex-1 text-[15px] font-bold">{title}</span>
        <span className="text-[15px] font-semibold text-muted-2 tabular-nums">{completed}</span>
        <ChevronRight size={18} className="text-muted" />
      </PressableLink>
    </div>
  );
}
