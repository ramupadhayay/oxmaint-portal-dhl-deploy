# One command to put the latest commit live: npm run deploy
#
# Does the whole cycle — pull, install, build, (re)start under PM2 — and stops
# at the first step that fails rather than carrying on and reporting success.
# That matters most at the build: PM2 restarting on a half-built .next serves a
# broken app that looks deployed.
#
# Safe to run when nothing has changed, and safe to run the very first time:
# it starts the process if PM2 has never heard of it and restarts it if it has,
# so there is no separate first-run script to remember.
#
# Written for Windows PowerShell 5.1 — no ternaries, no ??, no && — because
# that is what is on the host and pwsh may not be.

# NOT 'Stop'. Under 'Stop', anything a native command writes to stderr is
# promoted to a terminating error, and every tool here writes there in normal
# operation: git pull reports progress, npm prints warnings, and `pm2 describe`
# says "doesn't exist" — which is the answer being asked for, not a failure.
# The script killed itself on that warning. Exit codes are what these tools
# actually report failure with, so those are what is checked, step by step.
$ErrorActionPreference = 'Continue'

# The repo root is the script's parent, so this works from any working
# directory — including PM2's, which is not the one you think it is.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$APP = 'oxmaint'

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nFAILED: $msg" -ForegroundColor Red; exit 1 }

# ── preflight ────────────────────────────────────────────────────────────
if (-not (Test-Path '.env.local')) {
  Write-Host "No .env.local in $root" -ForegroundColor Yellow
  Write-Host "Copy .env.example to .env.local and set MONGO_URI and JWT_SECRET first." -ForegroundColor Yellow
  Write-Host "Without MONGO_URI the portal runs read-only: nothing anyone creates is saved." -ForegroundColor Yellow
  Fail 'missing .env.local'
}

# ── pull ─────────────────────────────────────────────────────────────────
Step 'Pulling latest'
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "branch: $branch"

# npm rewrites package-lock.json on some hosts — a different npm version, or
# optional dependencies that resolve differently on this platform. The next pull
# then refuses to touch a file the host has "modified", so this script broke its
# own second run.
#
# The lockfile is generated and the committed one is the authority, so a local
# rewrite of it is discarded rather than defended. Only that file: anything else
# dirty is somebody's work, and the pull below is left to refuse it.
$lock = git status --porcelain -- package-lock.json
if ($lock) {
  Write-Host 'discarding this host''s rewrite of package-lock.json' -ForegroundColor Yellow
  git checkout -- package-lock.json
}

# --ff-only: if the host has local commits this stops rather than opening a
# merge nobody is here to resolve.
git pull --ff-only origin $branch
if ($LASTEXITCODE -ne 0) {
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Host 'the host has local changes to tracked files:' -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "  $_" }
  }
  Fail 'git pull (local commits, local edits, or a diverged branch?)'
}

$sha = (git rev-parse --short HEAD).Trim()
$subject = (git log -1 --pretty=%s).Trim()
Write-Host "now at: $sha  $subject"

# ── install ──────────────────────────────────────────────────────────────
Step 'Installing dependencies'
# `npm install`, not `npm ci`, and the difference matters on this host.
#
# ci is the stricter command and never rewrites the lockfile, which is what
# caused the pull above to fail — so it looks like the obvious fix. It is not:
# ci works by deleting node_modules and rebuilding it, and PM2 is running the
# app out of that directory. It cannot unlink the binary it is executing, so it
# dies with EPERM partway through, having already removed part of the tree the
# live app was serving from.
#
# So the lockfile rewrite is dealt with where it lands — discarded before the
# pull — rather than by swapping in a command that takes the running app down
# to avoid it.
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail 'npm install' }

# ── build ────────────────────────────────────────────────────────────────
Step 'Building'
npm run build
if ($LASTEXITCODE -ne 0) { Fail 'next build - nothing was restarted, the running app is untouched' }

# ── start or restart ─────────────────────────────────────────────────────
Step 'Restarting under PM2'

# One command for both cases. The previous version asked `pm2 jlist` whether
# the app was registered and branched on the answer; on the host that check
# silently took a branch that did nothing, and because nothing afterwards
# looked at the result the script went on to report a successful deploy of an
# app PM2 had never heard of. startOrRestart is PM2's own answer to the
# question, so there is no detection left to get wrong.
#
# --update-env so a changed .env.local is picked up rather than the process
# keeping the environment it was first started with.
pm2 startOrRestart ecosystem.config.js --update-env
if ($LASTEXITCODE -ne 0) {
  # Older PM2 builds do not carry startOrRestart. A plain start is the same
  # thing for an app that is not running, which is the only case that can be
  # reached from here.
  Write-Host 'startOrRestart failed, falling back to start'
  pm2 start ecosystem.config.js
  if ($LASTEXITCODE -ne 0) { Fail 'pm2 could not start the app' }
}

# Persist the process list so it comes back after a reboot.
pm2 save | Out-Null

# ── verify ───────────────────────────────────────────────────────────────
# The step this script was missing. PM2 exiting zero means it accepted the
# instruction, not that the app came up: a process that throws on boot is
# registered, restarted a few times and left stopped, and every command above
# still succeeds. Without this the script printed "deployed" over an app that
# was not running.
Step 'Verifying'

$port = $env:PORT
if (-not $port) { $port = '3006' }
$url = "http://localhost:$port/portal/oxmaint/dashboard"

# Serving a page is the proof. PM2's own status is a weaker claim than this —
# a process that bound no port, or booted and is still compiling, is 'online'
# to PM2 — so it is read below only to explain a failure, never to decide one.
# The first version had that backwards and failed a deploy of an app that was
# already answering on this port.
#
# Polled rather than slept at once: the app is usually up in well under a
# second, and a fixed wait long enough for a cold host would be wasted on every
# other run.
Write-Host "asking $url"
$ok = $false
$why = ''
for ($i = 1; $i -le 10; $i++) {
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    if ($res.StatusCode -eq 200) { $ok = $true; break }
    $why = "HTTP $($res.StatusCode)"
  } catch {
    $why = $_.Exception.Message
  }
  Start-Sleep -Seconds 2
}

if (-not $ok) {
  Write-Host ("no answer on port " + $port + " after 10 tries: " + $why) -ForegroundColor Red

  # Read as lines and rejoined, not piped through Out-String: that formats to
  # the console width and folds this single very long line at 80 columns, which
  # puts newlines inside the JSON and makes it unparseable. That is what broke
  # the previous version of this check.
  $raw = ((& pm2 jlist 2>$null) -join '')
  $at = $raw.IndexOf('[')
  if ($at -ge 0) { $raw = $raw.Substring($at) }
  try {
    $apps = $raw | ConvertFrom-Json
    foreach ($a in $apps) {
      if ($a.name -eq $APP) {
        Write-Host ("pm2 status: " + $a.pm2_env.status + ", restarts: " + $a.pm2_env.restart_time) -ForegroundColor Yellow
      }
    }
  } catch {
    Write-Host 'could not read pm2 jlist' -ForegroundColor Yellow
  }

  Write-Host 'last 30 log lines:' -ForegroundColor Yellow
  pm2 logs $APP --lines 30 --nostream
  Fail 'the app is not serving'
}

Write-Host ("port " + $port + " answered 200") -ForegroundColor Green

Step 'Live'
pm2 status
Write-Host "`ndeployed $sha on $branch" -ForegroundColor Green
