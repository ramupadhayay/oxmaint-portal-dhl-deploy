// Shared notification store for the Autonomous Inspection portal. Every toast
// raised via the kit's useToasts() is also pushed here so it shows up in the
// TopBar bell. Seeded with drone / aircraft-inspection notifications.
//
// Hydration-safe: the seed is a static literal (no Date.now()/Math.random()),
// and live entries carry a caller-supplied relative time string.

const SEED = [
  { id: 1, type: 'critical', title: 'KC-135 wing corrosion',        msg: 'Left wing lower skin — 61 cm2 widespread corrosion, escalated',   time: '3 min ago',  read: false },
  { id: 2, type: 'critical', title: 'F-16 skin crack',              msg: '14 mm crack at the left wing fastener line — growth vs last check', time: '9 min ago',  read: false },
  { id: 3, type: 'warning',  title: 'SKY-01 battery 74%',           msg: 'Skydio X10 on E-6B fuselage sweep — return-to-dock in ~9 min',    time: '15 min ago', read: false },
  { id: 4, type: 'warning',  title: 'E-6B nacelle corrosion',       msg: 'No.2 engine nacelle lower lip — 32 cm2, thermal-corroborated',    time: '26 min ago', read: false },
  { id: 5, type: 'success',  title: 'MSN-4470 complete',            msg: 'F-16 100% skin coverage in 9 min — 4 anomalies logged',           time: '41 min ago', read: true },
  { id: 6, type: 'info',     title: 'Air-gap verified',             msg: 'No outbound connectivity — all data on the internal network',     time: '1 hr ago',   read: true },
  { id: 7, type: 'success',  title: 'GL-6500 cleared',              msg: 'Radome bird-strike dent repaired — post-repair verified',         time: '1.5 hr ago', read: true },
]

let list = SEED
let seq = 1000
const listeners = new Set()
function emit() { listeners.forEach((l) => l()) }

export function getNotifications() { return list }
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }

// Prepend a live notification (called from every toast). time defaults to
// 'just now' so we never touch Date during a render.
export function notify({ title, msg, type = 'info', time = 'just now' } = {}) {
  if (!title) return
  list = [{ id: seq++, type, title, msg, time, read: false }, ...list].slice(0, 30)
  emit()
}

export function markAllRead() { list = list.map((n) => ({ ...n, read: true })); emit() }
export function markRead(id) { list = list.map((n) => (n.id === id ? { ...n, read: true } : n)); emit() }
