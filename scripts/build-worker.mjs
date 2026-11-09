// Собирает worker (Telegram-бот + планировщик) в один файл dist/worker.mjs.
// Так Docker-образ worker'а содержит только этот файл и драйвер SQLite,
// а не все node_modules проекта — образ в разы меньше, деплой быстрее.
//
//   npm run build:worker   →   node dist/worker.mjs
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");

const result = await build({
  entryPoints: [path.join(root, "src/worker/index.ts")],
  outfile: path.join(root, "dist/worker.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm", // в worker'е top-level await
  // Нативный модуль не бандлится — ставится в образ отдельно
  external: ["better-sqlite3"],
  // Часть зависимостей — CommonJS и вызывает require() для модулей Node;
  // в ESM-бандле require нужно создать явно
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  tsconfig: path.join(root, "tsconfig.json"), // пути вида @/shared/...
  logLevel: "warning",
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
console.log(`✓ dist/worker.mjs (${(bytes / 1024 / 1024).toFixed(1)} МБ)`);
