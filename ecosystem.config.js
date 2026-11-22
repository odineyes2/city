// dev의 서비스 연결에서 사용하는 영구 PM2 앱. 빌드된 게임만 루프백으로 제공한다.
const path = require("node:path");
const fs = require("node:fs");
const local = {};
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) local[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
module.exports = {
  apps: [
    {
      name: "city",
      cwd: __dirname,
      script: path.join(__dirname, "server.mjs"),
      interpreter: process.execPath,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      env: {
        ...local,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: process.env.PORT || "8402",
      },
    },
  ],
};
