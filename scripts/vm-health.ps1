# What the host actually has left: npm run health
#
# Written because a deploy printed "cpu 86.9%" and nobody could say whether that
# was a problem. It is not, on its own — PM2 samples the host the instant it
# restarts an app, which is the one moment Node is compiling and pegging a core.
# The question that matters is what the box looks like when it is *idle*, and
# whether there is room to keep adding to it.
#
# So this measures rather than snapshots: CPU averaged over several seconds,
# memory with the page file included, disk per drive, and the two things that
# actually run a Windows app host out of road — node_modules directories and
# .next build caches, which grow every deploy and are never cleaned.
#
# Read-only. It starts nothing, stops nothing and deletes nothing.
#
# Windows PowerShell 5.1 — no ternaries, no ??, no && — same as deploy.ps1.

$ErrorActionPreference = 'Continue'

function Head($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Note($msg) { Write-Host "  $msg" -ForegroundColor DarkGray }
function Good($msg) { Write-Host "  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Bad($msg)  { Write-Host "  $msg" -ForegroundColor Red }

$gb = 1GB

# ── CPU, averaged ────────────────────────────────────────────────────────
#
# Five one-second samples, not one. A single reading catches whatever the box
# happened to be doing that instant, which is how a restart gets mistaken for a
# capacity problem.
Head 'CPU'
# Read outside the try, so the verdict at the bottom still knows the core count
# when the performance counter is unavailable.
$cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
try {
  $samples = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 5 -ErrorAction Stop).CounterSamples
  $vals = $samples | ForEach-Object { [math]::Round($_.CookedValue, 1) }
  $avg  = [math]::Round(($vals | Measure-Object -Average).Average, 1)
  $peak = ($vals | Measure-Object -Maximum).Maximum
  Note ("samples over 5s : " + ($vals -join '%, ') + '%')
  Note "logical cores   : $cores"
  if ($avg -lt 40) { Good "average $avg% (peak $peak%) - idle, plenty of headroom" }
  elseif ($avg -lt 75) { Warn "average $avg% (peak $peak%) - busy but coping" }
  else { Bad "average $avg% (peak $peak%) - sustained load, something is working hard" }
} catch {
  Warn "could not read the CPU counter: $($_.Exception.Message)"
}

# ── memory ───────────────────────────────────────────────────────────────
Head 'Memory'
$os = Get-CimInstance Win32_OperatingSystem
$totalMb = [math]::Round($os.TotalVisibleMemorySize / 1KB, 0)
$freeMb  = [math]::Round($os.FreePhysicalMemory / 1KB, 0)
$usedMb  = $totalMb - $freeMb
$usedPct = [math]::Round(($usedMb / $totalMb) * 100, 1)
Note "total  : $totalMb MB"
Note "in use : $usedMb MB ($usedPct%)"
if ($freeMb -gt 1500) { Good "free   : $freeMb MB - a build has room" }
elseif ($freeMb -gt 700) { Warn "free   : $freeMb MB - tight; a Next build wants ~1 GB" }
else { Bad "free   : $freeMb MB - a build here will swap or be killed" }

# The page file matters on a small box: Windows will keep going without free
# RAM, slowly, and that reads as "the app is broken" rather than "out of memory".
$pf = Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue
$pfDrives = @()
if ($pf) {
  foreach ($p in $pf) {
    Note "page file: $($p.Name) - $($p.CurrentUsage) MB of $($p.AllocatedBaseSize) MB used"
    $pfDrives += $p.Name.Substring(0, 2)
  }
}

# ── disk ─────────────────────────────────────────────────────────────────
# Judged on the share free as well as the gigabytes.
#
# A flat "under 15 GB is a warning" flagged a 16 GB temp disk that was 92%
# empty, which is the wrong advice: a small drive with almost nothing on it is
# not filling up. What matters is whether a drive is running out, and a drive
# only counts as running out when both numbers say so.
Head 'Disk'
Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  $freeGb  = [math]::Round($_.FreeSpace / $gb, 1)
  $totalGb = [math]::Round($_.Size / $gb, 1)
  $pct     = [math]::Round(($_.FreeSpace / $_.Size) * 100, 0)
  $tag = ''
  if ($pfDrives -contains $_.DeviceID) { $tag = ' (holds the page file)' }
  $line = "$($_.DeviceID) $freeGb GB free of $totalGb GB - $pct% free$tag"

  if ($freeGb -gt 10 -or $pct -gt 40) { Good $line }
  elseif ($freeGb -gt 4 -and $pct -gt 15) { Warn "$line - watch this" }
  else { Bad "$line - a build needs a few GB of scratch" }
}

# ── PM2 ──────────────────────────────────────────────────────────────────
#
# The restart count is the number worth reading. A process sitting at the same
# count for days is healthy; one that climbs between deploys is crash-looping,
# and PM2 will keep bringing it back so nothing ever looks down.
#
# Read before the process list, because which pids pm2 owns is what makes the
# process list worth reading.
Head 'PM2'
# Guarded with Get-Command rather than a redirect. `2>$null` silences what a
# command writes to stderr; it does nothing about PowerShell failing to find the
# command at all, which is a CommandNotFoundException and prints regardless.
#
# The JSON is parsed by node, not by PowerShell. PowerShell 5.1's
# ConvertFrom-Json is the old JavaScriptSerializer and it gives up on a payload
# this large — pm2 embeds every app's whole process environment — which is what
# printed "could not parse pm2 jlist" on a host where pm2 was fine.
$pm2Pids = @()
$pm2Cpu = 0
$pm2Count = 0
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Warn 'pm2 is not on this host - skipping'
} else {
  $summary = & pm2 jlist 2>$null | & node (Join-Path $PSScriptRoot 'pm2-summary.mjs')
  if (-not $summary) {
    Warn 'pm2 answered with nothing'
  } else {
    foreach ($line in $summary) {
      # Limited to 9 fields so the working directory, which is last, keeps
      # anything odd in it instead of shifting every column along.
      $f = $line -split '\|', 9
      if ($f[0] -eq 'ERROR') { Bad "pm2 output could not be read: $($f[1])"; continue }
      if ($f[0] -eq 'EMPTY') { Warn $f[1]; continue }

      $name, $status, $mb, $cpu, $restarts, $upH, $port, $procId, $cwd = $f
      $pm2Pids += [int]$procId
      $pm2Cpu += [double]$cpu
      $pm2Count++

      $where = ''
      if ($port) { $where = "port $port" }
      $out = "$name".PadRight(16) + "$status".PadRight(10) + "$mb MB".PadRight(9) +
             "cpu $cpu%".PadRight(9) + "restarts $restarts".PadRight(14) +
             "up ${upH}h".PadRight(12) + $where

      if ($status -ne 'online') { Bad $out }
      elseif ([int]$restarts -gt 20) { Warn "$out  <- restarting a lot" }
      else { Good $out }
      if ($cwd) { Note "                $cwd" }
    }
  }
}

# ── what is running ──────────────────────────────────────────────────────
#
# Every node process on the box, and whether pm2 owns it.
#
# This is the check that found the thing nobody was looking for: the largest
# node process on the host was one pm2 had never heard of. A process pm2 does
# not manage is a process that does not come back after a reboot, does not
# restart when it crashes, and does not appear in any deploy output — so the
# first anyone hears of it being gone is a customer saying a site is down.
Head 'Node processes'
$node = Get-Process node -ErrorAction SilentlyContinue
$strays = 0
if (-not $node) {
  Warn 'no node process is running'
} else {
  Note ('count: ' + $node.Count)
  $node | Sort-Object WorkingSet64 -Descending | ForEach-Object {
    $mb = [math]::Round($_.WorkingSet64 / 1MB, 0)
    $up = ''
    $hours = 0
    try {
      $hours = ((Get-Date) - $_.StartTime).TotalHours
      $up = 'up ' + [math]::Round($hours, 1) + 'h'
    } catch { }

    $line = "pid $($_.Id)".PadRight(12) + "$mb MB".PadRight(10) + $up.PadRight(14)

    if ($pm2Count -eq 0) {
      # Nothing to compare against. Without pm2 on the host, "not under pm2" is
      # not a finding about the process — it is a fact about the host, and
      # calling every process a stray would bury the ones that matter.
      Note $line
    } elseif ($pm2Pids -contains $_.Id) {
      Note ($line + 'pm2')
    } elseif ($hours -lt 0.2) {
      # This script's own `pm2 jlist` and node parser show up here. Seconds old
      # and about to exit, so they are noise rather than a finding.
      Note ($line + 'this health check')
    } elseif ($mb -lt 100 -and $hours -gt 24) {
      Note ($line + 'pm2 daemon, most likely')
    } else {
      $strays++
      Bad ($line + 'NOT under pm2 - nothing restarts this')

      # Identify it here rather than printing a command for somebody to run.
      # The whole point of finding an unmanaged process is to put it under pm2,
      # and to do that you need two things: the port it serves and the folder it
      # was started from. Both are available, so the script fetches them.
      # The pid is captured first. Inside a Where-Object scriptblock `$_` is that
      # pipeline's own item, not this ForEach-Object's, so comparing against
      # `$_.Id` in there would silently match nothing.
      $strayPid = $_.Id
      $listening = @()
      if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $listening = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
                       Where-Object { $_.OwningProcess -eq $strayPid } |
                       Select-Object -ExpandProperty LocalPort -Unique)
      }
      if ($listening.Count) { Note ('                serving port ' + ($listening -join ', ')) }
      else { Note '                not listening on any port - a worker or a build, not a site' }

      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$strayPid" -ErrorAction SilentlyContinue).CommandLine
      if ($cmd) {
        if ($cmd.Length -gt 150) { $cmd = $cmd.Substring(0, 150) + '...' }
        Note "                $cmd"
      }
    }
  }
  $totalNodeMb = [math]::Round((($node | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 0)
  Note "node total: $totalNodeMb MB"
  if ($strays -gt 0) {
    Warn "$strays node process(es) are running outside pm2 - nothing brings them back after a reboot or a crash."
    # Through next's own bin, not through npm. That is what this host's other
    # apps do and ecosystem.config.js says why: an npm script is a second
    # process between pm2 and the server, so pm2 ends up watching the wrapper —
    # Next crashes, npm stays alive, and the dashboard reports online while the
    # site is down. The command line printed above already shows the right form.
    Note 'To adopt one, mirror the command line above:'
    Note '  pm2 start "<folder>\node_modules\next\dist\bin\next" --name <name> --cwd "<folder>" -- start --port <port>'
    Note '  pm2 save     <- this is what makes it survive a reboot'
    Note 'Free the port first, or the new one crash-loops against the old:'
    Note '  Get-NetTCPConnection -LocalPort <port> -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }'
  }
}

# ── what the apps are costing on disk ────────────────────────────────────
#
# node_modules and .next are the two directories that grow on every deploy and
# are never cleaned. On a four-app host they are usually most of what is gone.
Head 'App folders'
$appRoot = 'C:\apps'
if (-not (Test-Path $appRoot)) {
  Note "no $appRoot on this host - skipping"
} else {
  $grand = 0
  Get-ChildItem $appRoot -Directory | ForEach-Object {
    $app = $_
    $parts = @()
    $appTotal = 0
    foreach ($sub in @('node_modules', '.next')) {
      $path = Join-Path $app.FullName $sub
      if (Test-Path $path) {
        $bytes = (Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue |
                  Measure-Object Length -Sum).Sum
        if (-not $bytes) { $bytes = 0 }
        $mb = [math]::Round($bytes / 1MB, 0)
        $appTotal += $bytes
        $parts += "$sub $mb MB"
      }
    }
    $grand += $appTotal
    $totalMbApp = [math]::Round($appTotal / 1MB, 0)
    Note ("$($app.Name)".PadRight(18) + "$totalMbApp MB".PadRight(12) + ($parts -join '  '))
  }
  Note ('all apps: ' + [math]::Round($grand / $gb, 2) + ' GB in node_modules and .next')
}

# ── the verdict ──────────────────────────────────────────────────────────
Head 'Room to keep building'
$sysFree = [math]::Round((Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / $gb, 1)
# Single-quoted: a backtick inside a double-quoted PowerShell string is the
# escape character, so "`next build`" printed a line break where the n was.
Note 'A "next build" on this repo needs roughly 1 GB of RAM and 1-2 GB of disk while it runs.'
Note "Free now: $freeMb MB RAM, $sysFree GB on C:."
if ($freeMb -gt 1200 -and $sysFree -gt 8) {
  Good 'Both are above what a build needs. Adding more screens is fine.'
} elseif ($freeMb -gt 700 -and $sysFree -gt 4) {
  Warn 'Enough to build, with little spare. Worth clearing old .next caches before a big change.'
} else {
  Bad 'Not enough spare to build safely. Free disk or memory before the next deploy.'
}

# Cores are a separate question from memory, and the one people are surprised
# by. Memory decides whether a build finishes; cores decide how long it takes,
# and on a two-core box a build saturates the machine for its whole duration —
# so the other apps on the host are slow for those minutes.
if ($cores -and $cores -le 2) {
  Warn "Only $cores cores: a build will use all of them, and the other apps on this host will be slow while it runs. Deploy when nobody is watching a demo."
}

# The cross-check that answers the question this script was written for.
#
# A high host CPU means nothing on its own. What tells you whether the portals
# are the load is the sum of what pm2 says they are using: if the host is busy
# and every app reads near zero, the work is being done by something else —
# antivirus scanning a fresh `git pull`, a background update, a process pm2 does
# not manage. Saying so beats leaving somebody to guess from one number.
if ($avg -and $pm2Count -gt 0) {
  $appCpu = [math]::Round($pm2Cpu, 1)
  Note "pm2 apps are using $appCpu% CPU between them; the host reads $avg%."
  if ($avg -gt 35 -and $appCpu -lt 10) {
    Warn 'The load is not the portals. Something else on this host is doing the work — a scan, an update, or a process outside pm2.'
    Note 'Worth noting: this script samples the CPU in its first five seconds, so whatever you ran just before it is still finishing.'
  }
}
