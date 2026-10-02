'use client'

import { useMemo, useState } from 'react'
import {
  PageHeader, Card, Section, StatStrip, Toolbar, DataTable, StatusBadge,
  StatusDot, Priority, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { ASSETS, LOCATIONS, SITES, TECHNICIANS, USER, between, pick } from '../lib/data'
import { useStore } from '../lib/store'
import CameraDetail from '../components/CameraDetail'
import VisionModels from '../components/VisionModels'
import VisionLiveAlert from '../components/VisionLiveAlert'
import { sceneFor, detectionsFor, SEVERITY_COLOR } from '../lib/visionScenes'
import { assetPath } from '@/lib/apiPath'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const MODEL_VERSION = '4.2.1'

const VIEWS = [
  'Line overview', 'Discharge end', 'Motor and drive', 'Guard perimeter',
  'Walkway and access', 'Panel and switchgear',
]

// Mostly online, because a bank of cameras that is a third offline is a site
// with a network problem rather than a site running vision monitoring.
const CAM_STATUS = [...Array(9).fill('Online'), 'Degraded', 'Offline']


const SEVERITIES = ['Critical', 'High', 'Medium', 'Low']

export default function AiVision() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [openCam, setOpenCam] = useState(null)
  // Dismissed by the viewer, or answered. Either way the band goes.
  const [alertDone, setAlertDone] = useState(false)
  const store = useStore()

  const d = useMemo(() => {
    const assets = scope(ASSETS)
    const locations = scope(LOCATIONS)
    const siteCode = new Map(SITES.map((s) => [s.site_id, s.code]))

    // Two cameras per functional location: one on the process and one on the
    // access route. Deriving them from locations rather than assets is what
    // keeps the camera list stable when the asset register changes.
    const cameras = locations.flatMap((loc, li) => [0, 1].map((n) => {
      const k = `cam-${loc.functional_location_id}-${n}`
      const covered = assets.filter((a) => a.functional_location_id === loc.functional_location_id)
      return {
        camera_id: k,
        name: `CAM-${siteCode.get(loc.site_id) || 'OXM'}-${String(li * 2 + n + 1).padStart(2, '0')}`,
        // Round-robin rather than hashed.
        //
        // `pick` spreads six views over twenty cameras evenly enough in
        // aggregate, and badly where it is read: the first six panels drew only
        // three distinct views, so the top row and the row under it were the
        // same three photographs with different captions. Each frame claims to
        // be that camera's field of view, and two cameras in different halls
        // cannot have an identical one — repeating them side by side makes the
        // whole estate read as wallpaper.
        //
        // Cycling means the first six panels are six different views and each
        // location's two cameras always watch two different things, which is
        // also what a real pair of cameras on one location is for.
        view: VIEWS[(li * 2 + n) % VIEWS.length],
        location_name: loc.name,
        site_id: loc.site_id,
        status: pick(k + 'st', CAM_STATUS),
        confidence: between(k + 'c', 88, 99, 1),
        fps: pick(k + 'f', [12, 15, 25]),
        last_inference_s: between(k + 'li', 1, 55),
        inferences_today: between(k + 'it', 2400, 16800),
        assets_covered: covered.length,
      }
    }))

    // The log is what the cameras found, not a second list beside them.
    //
    // Each online camera raises its current-frame detections as open alerts, and
    // the same detection from the same camera earlier in the window as answered
    // ones. So a camera showing two detections has at least two alerts, the
    // register and the panels agree, and clicking into a camera shows its own
    // history rather than an empty section — which is what a separate random
    // draw of sixteen alerts over twenty cameras produced.
    const alerts = []
    let seq = 0
    for (const cam of cameras) {
      if (cam.status === 'Offline') continue
      const found = detectionsFor(cam)
      const asset = assets.find((a) => a.functional_location_name === cam.location_name) || assets[0] || null

      found.forEach((det, di) => {
        const k = `${cam.camera_id}-${di}`
        // One open alert for what is in frame now, then a short history of the
        // same finding — an obstruction reported twice this shift is the normal
        // case, not a fresh problem each time.
        const history = between(k + 'h', 0, 2)
        for (let h = 0; h <= history; h += 1) {
          seq += 1
          alerts.push({
            alert_id: `vsa_${String(seq).padStart(3, '0')}`,
            reference: `VIS-${900 + seq}`,
            detected_minutes: h === 0 ? between(k + 'm', 2, 55) : between(`${k}-${h}`, 90, 900),
            type: det.label,
            category: det.category || 'Condition',
            severity: det.severity,
            asset_name: asset?.asset_name || '—',
            asset_code: asset?.asset_code || '',
            site_id: cam.site_id,
            camera: cam.name,
            location_name: cam.location_name,
            confidence: h === 0 ? det.conf : between(`${k}-${h}c`, 72, 97, 1),
            // Only what is in frame now is still open. An older one has been
            // looked at, or it would still be in frame.
            status: h === 0 ? 'Open' : pick(`${k}-${h}s`, ['Acknowledged', 'Closed', 'Closed']),
            reviewer: pick(`${k}-${h}r`, TECHNICIANS).name,
          })
        }
      })
    }
    alerts.sort((a, b) => a.detected_minutes - b.detected_minutes)

    return {
      cameras, alerts,
      online: cameras.filter((c) => c.status === 'Online').length,
      inferences: cameras.reduce((n, c) => n + c.inferences_today, 0),
      openAlerts: alerts.filter((a) => a.status === 'Open').length,
    }
  }, [scope])


  /**
   * The one detection worth interrupting somebody for.
   *
   * The worst live finding on the estate — critical before high, and the first
   * such camera in a stable order so the band names the same camera on every
   * render and on a reload. A demo where the alert moves each time you look at
   * it is one nobody can point at.
   *
   * Only from an online camera. A degraded one reports its highest finding and
   * an offline one reports nothing, which is already how `detectionsFor` reads
   * them; taking the top of that is the same rule applied to the estate.
   */
  const live = useMemo(() => {
    const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 }
    let best = null
    for (const cam of d.cameras) {
      if (cam.status === 'Offline') continue
      for (const det of detectionsFor(cam)) {
        const rank = RANK[det.severity] ?? 9
        if (rank > 1) continue           // only critical and high interrupt
        if (best && rank >= best._rank) continue
        const asset = ASSETS.find((a) => a.functional_location_name === cam.location_name)
        best = {
          _rank: rank,
          label: det.label,
          severity: det.severity,
          conf: det.conf,
          camera: cam.name,
          view: cam.view,
          location: cam.location_name,
          siteId: cam.site_id,
          assetId: asset?.asset_id || '',
          assetName: asset?.asset_name || '',
          assetCode: asset?.asset_code || '',
        }
      }
    }
    return best
  }, [d.cameras])

  /**
   * Act on it: raise the job, record who was told.
   *
   * The work order goes in under the ordinary `work_order` kind rather than a
   * vision-specific one, because a job raised by a camera is still a job — it
   * belongs in the same queue that gets assigned, chased and closed. The
   * escalation is a separate record and says in its own text that it was
   * recorded rather than delivered.
   */
  const actOnAlert = async ({ raiseWorkOrder, notify, note }) => {
    const a = live
    if (!a) return
    const stamp = new Date().toISOString()
    let raised = null

    if (raiseWorkOrder) {
      raised = await store.create('work_order', {
        title: `${a.label} — ${a.camera}`,
        description: [
          `Raised from AI Vision. ${a.camera} (${a.view}) detected "${a.label}" at ${a.conf}% confidence in ${a.location}.`,
          note,
        ].filter(Boolean).join(' '),
        status: 'Open',
        priority: a.severity === 'Critical' ? 'Critical' : 'High',
        work_order_type: 'Corrective',
        asset_id: a.assetId,
        asset_name: a.assetName,
        asset_code: a.assetCode,
        location_name: a.location,
        site_id: a.siteId,
        assigned_to_name: '',
        created_date: stamp,
        due_date: stamp,
        estimated_hours: 2,
        source: 'AI Vision',
        source_camera: a.camera,
        source_detection: a.label,
        source_confidence: a.conf,
      })
    }

    await store.create('vision_escalation', {
      title: `${a.label} — ${a.camera}`,
      camera: a.camera,
      view: a.view,
      location: a.location,
      site_id: a.siteId,
      detection: a.label,
      severity: a.severity,
      confidence: a.conf,
      informed: notify.map((r) => r.label),
      work_order_id: raised?.workorder_id || raised?.recordId || '',
      note,
      raised_by: USER.name,
      raised_at: stamp,
      // Said in the record itself, so a reader of the data is told what a
      // reader of the screen is told.
      delivery: 'Recorded in the portal — no message was sent',
    })

    const parts = [
      raised ? `work order ${raised.work_order_number || raised.recordId} raised` : '',
      notify.length ? `${notify.map((r) => r.label).join(', ')} listed to inform` : '',
    ].filter(Boolean)
    store.notify(parts.join(' · ') || 'Recorded.')
    setAlertDone(true)
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return d.alerts.filter((a) => (
      (severity === 'all' || a.severity === severity) &&
      (status === 'all' || a.status === status) &&
      (!q || [a.reference, a.type, a.asset_name, a.camera, a.location_name].join(' ').toLowerCase().includes(q))
    ))
  }, [d.alerts, search, severity, status])

  const ago = (m) => (m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('ai-vision', '#15227a')}
        title="AI Vision"
        subtitle={`${d.cameras.length} cameras · edge inference · ${siteName}`}
        right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, fontWeight: 600 }}>
          <StatusDot color={GREEN} pulse />Inference running
        </span>}
      />

      {!alertDone && (
        <VisionLiveAlert
          alert={live}
          onOpenCamera={() => setOpenCam(d.cameras.find((c) => c.name === live.camera) || null)}
          onResolve={actOnAlert}
          onDismiss={() => setAlertDone(true)}
        />
      )}

      <StatStrip items={[
        { label: 'Cameras online', value: d.online, tone: d.online === d.cameras.length ? 'green' : 'amber', note: `of ${d.cameras.length} installed` },
        { label: 'Inferences today', value: d.inferences.toLocaleString('en-US'), note: 'frames scored at the edge' },
        { label: 'Alerts open', value: d.openAlerts, tone: d.openAlerts ? 'red' : 'green', note: `${d.alerts.length} raised in total` },
        { label: 'Critical alerts', value: d.alerts.filter((a) => a.severity === 'Critical' && a.status !== 'Closed').length, tone: 'red', note: 'not yet closed' },
        { label: 'Model version', value: MODEL_VERSION, note: 'plant vision model' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ marginTop: 1 }}>{sectionIcon('ai-vision', ACCENT)}</div>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          Frames are scored on the edge device at each camera and only the results travel — no footage is
          carried into this portal. The panels below are the monitoring view for each camera: they show
          what the camera is watching, its state and its last result. They are not a video stream, and
          this build carries no recorded footage.
        </p>
      </Card>

      <Section title="Camera estate" right={<span style={{ fontSize: 11.5, color: MUTE }}>{d.cameras.length} panels · {siteName}</span>}>
        {d.cameras.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 12 }}>
            {d.cameras.map((c) => (
              <CameraPanel key={c.camera_id} cam={c} onOpen={() => setOpenCam(c)} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No cameras configured at {siteName}.</div>
        )}
      </Section>

      <VisionModels cameras={d.cameras} />

      <Section title="Recent vision alerts">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search reference, alert, asset, camera…"
          filters={[
            { label: 'Severity', value: severity, onChange: setSeverity, options: SEVERITIES },
            { label: 'Status', value: status, onChange: setStatus, options: ['Open', 'Acknowledged', 'Closed'] },
          ]}
          right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
        />
        <DataTable
          pageSize={10}
          rows={rows}
          empty="No vision alerts match these filters."
          columns={[
            { key: 'reference', label: 'Ref', render: (r) => <span style={{ fontWeight: 700, color: ACCENT }}>{r.reference}</span> },
            { key: 'type', label: 'Detection', render: (r) => <span style={{ fontWeight: 600 }}>{r.type}</span> },
            { key: 'category', label: 'Category', render: (r) => <StatusBadge tone="grey">{r.category}</StatusBadge> },
            { key: 'severity', label: 'Severity', sortValue: (r) => SEVERITIES.indexOf(r.severity), render: (r) => <Priority value={r.severity} /> },
            { key: 'asset_name', label: 'Asset', render: (r) => (
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.asset_name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.asset_code}</span>
              </span>
            ) },
            { key: 'camera', label: 'Camera', render: (r) => (
              <span>
                <span style={{ display: 'block' }}>{r.camera}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.location_name}</span>
              </span>
            ) },
            { key: 'confidence', label: 'Confidence', align: 'right', render: (r) => `${r.confidence}%` },
            { key: 'detected_minutes', label: 'Detected', align: 'right', render: (r) => <span style={{ whiteSpace: 'nowrap', color: SUB }}>{ago(r.detected_minutes)}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
            { key: 'reviewer', label: 'Reviewer' },
          ]} />
      </Section>

      <CameraDetail cam={openCam} alerts={d.alerts} onClose={() => setOpenCam(null)} />
    </div>
  )
}

function CameraPanel({ cam, onOpen }) {
  const offline = cam.status === 'Offline'
  const tone = offline ? RED : cam.status === 'Degraded' ? AMBER : GREEN
  const scene = sceneFor(cam.view)
  const found = detectionsFor(cam)
  // Tracks whether the frame actually arrived, not merely whether it failed.
  //
  // "Has not errored yet" is the wrong test: between the request going out and
  // the 404 coming back, a broken image is indistinguishable from a loading one
  // — and in that window the detection box was being drawn over nothing. A box
  // floating on an empty panel is worse than no box, because it looks like a
  // finding rather than a missing file. So the overlay waits for onLoad, and the
  // bracket placeholder holds the panel until then.
  const [frameReady, setFrameReady] = useState(false)
  const [hot, setHot] = useState(false)

  // onLoad alone is not enough. A frame the browser already holds can be
  // `complete` before React attaches the handler, and the event never arrives —
  // so the panel keeps its placeholder over an image that has been ready the
  // whole time. The callback ref runs with the element in hand and can just ask.
  const frameRef = (el) => { if (el && el.complete && el.naturalWidth > 0) setFrameReady(true) }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      title={`Open ${cam.name}`}
      style={{
        borderStyle: 'solid', borderWidth: 1, borderColor: hot ? '#c7d2fe' : LINE,
        borderRadius: 12, overflow: 'hidden', background: '#fff', cursor: 'pointer', outline: 'none',
        boxShadow: hot ? '0 6px 18px rgba(15,23,42,0.10)' : 'none',
        transform: hot ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow .15s, transform .15s, border-color .15s',
      }}
    >
      <div style={{
        position: 'relative', height: 132,
        background: offline
          ? '#f1f5f9'
          : 'repeating-linear-gradient(135deg,#0f172a 0px,#0f172a 12px,#131d33 12px,#131d33 24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}>
        {!offline && (
          <img
            ref={frameRef}
            src={assetPath(scene.file)}
            alt={`${cam.view} — illustrative reference frame`}
            onLoad={() => setFrameReady(true)}
            onError={() => setFrameReady(false)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: frameReady ? 1 : 0,
            }}
          />
        )}

        {/* Corner brackets stand in for the framing overlay the edge device
            draws, and are what the panel falls back to when no reference frame
            is on disk. No footage ships with this build either way, so the panel
            says what it is rather than pretending to be a feed. */}
        {(offline || !frameReady) && (
          <>
            <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, opacity: offline ? 0.25 : 0.55 }}>
              <path d="M8 26V8h22M170 8h22v18M192 94v18h-22M30 112H8V94"
                fill="none" stroke={offline ? '#94a3b8' : '#93c5fd'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <span style={{
              position: 'relative', fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.5,
              color: offline ? '#64748b' : 'rgba(226,232,240,0.85)', maxWidth: 210,
            }}>
              {offline ? 'Camera offline — no results since the last heartbeat' : 'Monitoring view · results only, no video stream'}
            </span>
          </>
        )}

        {/* The highest-severity finding, boxed, so the grid reads at a glance.
            The rest are in the panel this card opens. */}
        {!offline && frameReady && found.slice(0, 1).map((f) => (
          <div key={f.label} style={{
            position: 'absolute',
            left: `${f.box[0] * 100}%`, top: `${f.box[1] * 100}%`,
            width: `${f.box[2] * 100}%`, height: `${f.box[3] * 100}%`,
            borderStyle: 'solid', borderWidth: 2,
            borderColor: SEVERITY_COLOR[f.severity] || '#dc2626', borderRadius: 2,
          }} />
        ))}

        <span style={{
          position: 'absolute', top: 9, left: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
          color: offline ? '#64748b' : '#e2e8f0',
          textShadow: frameReady && !offline ? '0 1px 3px rgba(2,6,23,0.9)' : 'none',
        }}>{cam.name}</span>

        {!offline && frameReady && (
          <span style={{
            position: 'absolute', bottom: 7, left: 9, padding: '2px 6px', borderRadius: 999,
            background: 'rgba(2,6,23,0.66)', color: '#e2e8f0', fontSize: 9, fontWeight: 700,
          }}>Illustrative</span>
        )}
        <span style={{ position: 'absolute', top: 8, right: 10 }}>
          <StatusDot color={tone} pulse={!offline} />
        </span>
      </div>

      <div style={{ padding: '11px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.view}</span>
          <StatusBadge tone={offline ? 'red' : cam.status === 'Degraded' ? 'amber' : 'green'}>{cam.status}</StatusBadge>
        </div>
        <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 9 }}>
          {cam.location_name} · {cam.assets_covered} assets in frame
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: SUB, paddingTop: 9, borderTop: `1px solid ${LINE}` }}>
          <span>{offline ? 'Last result —' : `Last result ${cam.last_inference_s}s ago`}</span>
          <span style={{ fontWeight: 700, color: offline ? MUTE : INK }}>{offline ? '—' : `${cam.confidence}% conf`}</span>
          <span>{cam.fps} fps</span>
        </div>
        <div style={{
          marginTop: 8, paddingTop: 8, borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          fontSize: 11, fontWeight: 700, color: hot ? ACCENT : MUTE, transition: 'color .15s',
        }}>
          <span>
            {offline
              ? 'No detections — camera offline'
              : `${found.length} detection${found.length === 1 ? '' : 's'} in frame`}
          </span>
          <span>View detections →</span>
        </div>
      </div>
    </div>
  )
}
