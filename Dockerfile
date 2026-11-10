# syntax=docker/dockerfile:1
# Один Dockerfile — два образа:
#   --target web     Next.js (standalone-сборка, без исходников и dev-зависимостей)
#   --target worker  Telegram-бот + планировщик: один JS-файл (esbuild) + драйвер SQLite
# glibc-образ (bookworm), чтобы better-sqlite3 брал готовые бинарники.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── зависимости (инструменты сборки — на случай, если для платформы нет готового better-sqlite3)
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── сборка Next.js
FROM base AS build
# Экономная сборка (next.config.ts): маленький VPS не должен зависать от нехватки памяти
ENV LOW_MEMORY_BUILD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── веб-приложение
FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/avetrack.db \
    MIGRATIONS_DIR=/app/drizzle
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/drizzle ./drizzle
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── сборка worker'а в один файл. FROM deps — node_modules уже на месте, без копирования;
#    не зависит от сборки Next.js, поэтому идёт параллельно с ней и пересобирается за секунды
FROM deps AS worker-build
COPY tsconfig.json ./
COPY scripts/build-worker.mjs ./scripts/
COPY src ./src
RUN node scripts/build-worker.mjs

# ── драйвер SQLite — единственный модуль, который не входит в бандл (нативный).
#    Ставится отдельно той же версии, что в package-lock.json; пересобирается только при её смене
FROM deps AS worker-runtime
RUN mkdir /runtime && cd /runtime \
  && printf '{"name":"avetrack-worker","private":true,"type":"module","scripts":{"backup":"node --env-file-if-exists=.env scripts/backup.mjs"}}\n' > package.json \
  && npm install --no-audit --no-fund --omit=dev \
     "better-sqlite3@$(node -p "require('/app/package-lock.json').packages['node_modules/better-sqlite3'].version")"

# ── worker (бот + cron + скрипт бэкапа): ~15 МБ вместо всех node_modules проекта
FROM base AS worker
ENV NODE_ENV=production \
    DATABASE_PATH=/data/avetrack.db \
    MIGRATIONS_DIR=/app/drizzle \
    BACKUP_DIR=/backups
COPY --from=worker-runtime /runtime ./
COPY --from=worker-build /app/dist/worker.mjs ./worker.mjs
COPY drizzle ./drizzle
COPY scripts/backup.mjs ./scripts/backup.mjs
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
CMD ["node", "worker.mjs"]
