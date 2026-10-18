import {
  Baby,
  BookOpen,
  Briefcase,
  Camera,
  Car,
  ChartPie,
  Code,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  House,
  Inbox,
  Leaf,
  List,
  Music,
  Palette,
  PawPrint,
  Plane,
  ShoppingCart,
  Sparkles,
  Star,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Иконки пользовательских списков. В БД хранится ключ. */
export const LIST_ICONS = {
  list: List,
  inbox: Inbox,
  briefcase: Briefcase,
  house: House,
  cart: ShoppingCart,
  heart: Heart,
  book: BookOpen,
  study: GraduationCap,
  dumbbell: Dumbbell,
  plane: Plane,
  code: Code,
  game: Gamepad2,
  chart: ChartPie,
  palette: Palette,
  camera: Camera,
  music: Music,
  film: Film,
  food: Utensils,
  car: Car,
  wallet: Wallet,
  gift: Gift,
  star: Star,
  sparkles: Sparkles,
  leaf: Leaf,
  paw: PawPrint,
  baby: Baby,
} satisfies Record<string, LucideIcon>;

export type ListIconKey = keyof typeof LIST_ICONS;

export const LIST_ICON_KEYS = Object.keys(LIST_ICONS) as ListIconKey[];

export function listIcon(key: string): LucideIcon {
  return LIST_ICONS[key as ListIconKey] ?? List;
}
