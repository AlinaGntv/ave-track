// После `next build` (output: standalone) копирует статику и public внутрь .next/standalone —
// сам Next этого не делает. Запускается автоматически из `npm run build`.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("Нет .next/standalone — сначала выполните next build");
  process.exit(1);
}

const copies = [
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(root, "public"), path.join(standalone, "public")],
];
for (const [from, to] of copies) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}
console.log("✓ .next/standalone готов к запуску");
