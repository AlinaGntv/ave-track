"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/** На компьютере обычные экраны — колонкой по центру, календарь — на всю ширину. */
export function ContentWidth({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = pathname.startsWith("/calendar");
  return <div className={cn(!wide && "lg:mx-auto lg:max-w-2xl")}>{children}</div>;
}
