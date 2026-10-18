"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/shared/ui/Segmented";
import { useTheme, type ThemePreference } from "@/shared/ui/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "system", label: "Авто", icon: Monitor },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
];

export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return <Segmented label="Тема" options={OPTIONS} value={preference} onChange={setPreference} />;
}
