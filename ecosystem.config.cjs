// PM2: запуск без Docker на VPS.
//   npm ci && npm run build
//   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
// Переменные берутся из .env в корне проекта.
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "avetrack-web",
      cwd: root,
      script: "scripts/start.mjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      time: true,
    },
    {
      name: "avetrack-worker",
      cwd: root,
      script: "src/worker/index.ts",
      interpreter: "node",
      node_args: "--env-file-if-exists=.env --import tsx",
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M",
      time: true,
    },
    {
      // Ежедневный бэкап в 03:30 (время сервера); между запусками процесс не висит
      name: "avetrack-backup",
      cwd: root,
      script: "scripts/backup.mjs",
      node_args: "--env-file-if-exists=.env",
      cron_restart: "30 3 * * *",
      autorestart: false,
      time: true,
    },
  ],
};
