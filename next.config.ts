import type { NextConfig } from "next";

/**
 * Экономная сборка для маленького сервера (LOW_MEMORY_BUILD=1 задаёт Dockerfile):
 * без проверки типов (её прогоняет `npm run typecheck` перед отправкой кода),
 * в один поток и с экономией памяти webpack — пиковое потребление заметно ниже.
 */
const lowMemory = process.env.LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
  ...(lowMemory && {
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
    experimental: {
      cpus: 1,
      workerThreads: false,
      webpackMemoryOptimizations: true,
    },
  }),
};

export default nextConfig;
