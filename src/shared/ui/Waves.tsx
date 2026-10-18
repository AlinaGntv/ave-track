import { cn } from "@/shared/lib/cn";

const LINES = Array.from({ length: 22 }, (_, i) => {
  const o = i * 2.6;
  return `M-20 ${70 + o} C 70 ${6 + o * 1.5}, 150 ${150 - o * 1.2}, 250 ${60 + o * 0.5} S 380 ${10 + o * 1.1}, 440 ${40 + o * 0.4}`;
});

/** Декоративные линии-волны с тёмных карточек из дизайна. */
export function Waves({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 180"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.55}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      {LINES.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
