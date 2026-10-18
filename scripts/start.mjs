// Запуск production-сборки без Docker (npm start, PM2).
// server.js из standalone-сборки делает chdir в свою папку, поэтому относительные пути
// из .env (DATABASE_PATH=./data/…) заранее превращаются в абсолютные — от корня проекта.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

process.env.NODE_ENV = "production";
process.env.DATABASE_PATH = path.resolve(root, process.env.DATABASE_PATH ?? "./data/avetrack.db");
process.env.MIGRATIONS_DIR = path.join(root, "drizzle");
process.env.PORT ??= "3000";
process.env.HOSTNAME ??= "127.0.0.1";

const server = path.join(root, ".next", "standalone", "server.js");
if (!fs.existsSync(server)) {
  console.error("Нет production-сборки. Выполните: npm run build");
  process.exit(1);
}
await import(pathToFileURL(server).href);
