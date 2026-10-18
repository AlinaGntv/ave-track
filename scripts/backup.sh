#!/usr/bin/env sh
# Бэкап базы для cron на VPS (без Docker). Пример crontab — каждый день в 03:30:
#   30 3 * * * /path/to/avetrack/scripts/backup.sh >> /path/to/avetrack/backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
exec node --env-file-if-exists=.env scripts/backup.mjs
