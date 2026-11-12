#!/usr/bin/env bash
# Обновление на сервере одной командой:
#   cd /opt/avetrack && bash scripts/deploy.sh
#
# 1. Если нет swap — создаёт файл подкачки на 2 ГБ (без него сборка на маленьком VPS
#    может съесть всю память и повесить сервер).
# 2. git pull.
# 3. Собирает образы по очереди — сначала web, потом worker, — чтобы две сборки
#    не занимали память одновременно. Пока идёт сборка, работает старая версия.
# 4. Перезапускает контейнеры и удаляет старые образы.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

step "Память"
free -h
if [ -z "$(swapon --show --noheadings)" ]; then
  echo "Swap нет — создаю /swapfile на 2 ГБ (защита от зависания при сборке)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  free -h
fi

step "Обновление кода"
git pull --ff-only

mkdir -p backups && chown 1000:1000 backups

step "Сборка web (самая долгая часть, несколько минут)"
docker compose build web

step "Сборка worker"
docker compose build worker

step "Перезапуск"
docker compose up -d

step "Очистка старых образов"
docker image prune -f >/dev/null
# Маленький диск: кэш сборки (гигабайты) удаляем — следующая сборка будет дольше, зато место не кончится
if [ "$(df --output=avail -k / | tail -1)" -lt $((4 * 1024 * 1024)) ]; then
  docker builder prune -af >/dev/null
fi
df -h /

step "Готово"
docker compose ps
