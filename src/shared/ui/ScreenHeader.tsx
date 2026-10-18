import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { PressableLink } from "./Pressable";
import { RefreshButton } from "./RefreshButton";

/** Шапка экрана как на «Today» из дизайна: мелкая подпись + крупный заголовок. */
export function ScreenHeader({
  caption,
  title,
  right,
  back,
  refresh = true,
}: {
  caption?: string;
  title: string;
  right?: ReactNode;
  back?: { href: string; label: string };
  /** Кнопка «Обновить» справа (на экранах с данными) */
  refresh?: boolean;
}) {
  return (
    <header className="px-6 pt-8 pb-4">
      {back && (
        <PressableLink
          href={back.href}
          className="-ml-2 mb-2 inline-flex h-11 items-center gap-0.5 pr-3 text-[15px] font-semibold text-muted-2"
        >
          <ChevronLeft size={22} />
          {back.label}
        </PressableLink>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {caption && <p className="text-sm font-medium text-muted-2 first-letter:uppercase">{caption}</p>}
          <h1 className="mt-1 truncate text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
        </div>
        {(refresh || right) && (
          <div className="-mr-1.5 flex shrink-0 items-center gap-1 pb-0.5">
            {refresh && <RefreshButton />}
            {right}
          </div>
        )}
      </div>
    </header>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 pt-7 pb-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {right}
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="mx-6 rounded-[24px] border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
