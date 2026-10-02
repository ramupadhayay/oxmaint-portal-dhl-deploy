// One line per PM2 app, for vm-health.ps1 to colour.
//
// This exists because PowerShell 5.1 cannot parse `pm2 jlist`. Its
// ConvertFrom-Json is the old JavaScriptSerializer, which gives up on input
// this large and this deeply nested — and pm2 embeds the whole process
// environment of every app in that payload, so three apps is already past it.
// It failed with "could not parse pm2 jlist" on a host where pm2 was working
// perfectly.
//
// Node is on the box by definition; this is a Node host. So the JSON is parsed
// by the thing that speaks JSON, and PowerShell gets back plain pipe-separated
// text it cannot choke on.
//
// Usage: pm2 jlist | node scripts/pm2-summary.mjs

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { raw += c })
process.stdin.on('end', () => {
  // pm2 sometimes prefixes the JSON with a line of its own. Start at the array.
  const start = raw.indexOf('[')
  if (start < 0) {
    console.log('ERROR|pm2 printed no JSON')
    return
  }

  let apps
  try {
    apps = JSON.parse(raw.slice(start))
  } catch (e) {
    console.log(`ERROR|${e.message}`)
    return
  }

  if (!apps.length) {
    console.log('EMPTY|pm2 is running but manages nothing')
    return
  }

  for (const a of apps) {
    const env = a.pm2_env || {}
    const mb = Math.round((a.monit?.memory || 0) / 1048576)
    const cpu = a.monit?.cpu ?? 0
    // pm_uptime is when the current run started, so this is uptime since the
    // last restart — which is the number that matters when asking whether
    // something is quietly crash-looping.
    const upH = env.pm_uptime
      ? Math.round(((Date.now() - env.pm_uptime) / 3600000) * 10) / 10
      : 0
    const port = env.env?.PORT || (env.args || []).join(' ').match(/-p\s*(\d+)/)?.[1] || ''
    console.log([
      a.name,
      env.status || 'unknown',
      mb,
      cpu,
      env.restart_time ?? 0,
      upH,
      port,
      // The pid is here so the caller can tell which node processes on the box
      // pm2 is not managing. One that pm2 has never heard of is one that
      // nothing will restart after a reboot.
      a.pid || 0,
      env.cwd || '',
    ].join('|'))
  }
})
