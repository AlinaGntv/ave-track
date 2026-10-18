# syntax=docker/dockerfile:1
# Один Dockerfile — два образа:
#   --target web     Next.js (standalone-сборка, без исходников и dev-зависимостей)
#   --target worker  Telegram-бот + планировщик (запускается из исходников через tsx)
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

# ── worker (бот + cron + скрипт бэкапа)
FROM base AS worker
ENV NODE_ENV=production \
    DATABASE_PATH=/data/avetrack.db \
    MIGRATIONS_DIR=/app/drizzle \
    BACKUP_DIR=/backups
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
CMD ["node", "--import", "tsx", "src/worker/index.ts"]
