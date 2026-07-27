module.exports = {
  apps: [
    {
      name: "bart-app",
      cwd: "/home/bart/BART",
      script: "dist/index.cjs",
      interpreter: "node",
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      out_file: "/home/bart/.pm2/logs/bart-app-out.log",
      error_file: "/home/bart/.pm2/logs/bart-app-error.log",
      time: true,
    },
  ],
};
