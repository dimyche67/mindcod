module.exports = {
  apps: [
    {
      name: "mindcod-backend",
      script: "./backend/server.js",
      cwd: "/var/www/mindcod.ru",
      interpreter: "node",

      // Env production
      env_production: {
        NODE_ENV: "production",
        PORT: 8787,
      },

      // Restart policy
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,

      // Logs
      out_file: "/var/log/mindcod/backend.log",
      error_file: "/var/log/mindcod/backend-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Memory limit — перезапуск при превышении 512MB
      max_memory_restart: "512M",
    },
  ],
};
