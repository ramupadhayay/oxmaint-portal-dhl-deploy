// PM2 process definition for the VM.
//
// `next start` is invoked through its own bin rather than through npm: an npm
// script is a second process between PM2 and the server, and PM2 then watches
// the wrapper — a crash in Next leaves npm alive and the app down while the
// dashboard reports it online.
//
// Port 3006 because 3005 is already taken on this host. It is read from the
// environment so a second instance can be brought up on another port without
// editing a tracked file.
const PORT = process.env.PORT || '3006'

module.exports = {
  apps: [
    {
      name: 'oxmaint',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${PORT}`,
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT,
      },
    },
  ],
}
