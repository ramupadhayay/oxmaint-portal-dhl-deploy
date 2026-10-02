'use client'

// One camera, opened.
//
// The estate grid answers "is it up"; this answers "what is it seeing". The
// frame with its detection boxes is the whole point — a list of alert text tells
// you a guard door was open, and a box round the guard door tells you which one.
//
// The frame is a generated reference still, and the panel says so twice: once on
// the image itself and once under it. That is not over-caution. A photorealistic
// plant frame with a red box on it is the single most convincing thing on this
// screen, and it is the one thing here that is not a measurement — the portal
// carries no footage, and a viewer who leaves believing otherwise has been
// misled by us rather than by the demo.
//
// A camera that is offline shows no boxes at all. It is not producing results,
// and drawing its scene's detections anyway would be the screen inventing an
// inference that never ran.

import { useState } from 'react'
import { Modal, StatusBadge, StatusDot, PALETTE } from '../lib/kit'
import { sceneFor, detectionsFor, SEVERITY_COLOR } from '../lib/visionScenes'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

export default function CameraDetail({ cam, alerts = [], onClose }) {
  // Waits for the frame to arrive rather than for it to fail — a detection box
  // drawn over a still-loading or missing image reads as a finding, not as a
  // gap. See the same reasoning on the grid panel.
  const [frameReady, setFrameReady] = useState(false)

  // onLoad alone is not enough. A frame the browser already holds can be
  // `complete` before React attaches the handler, and the event never arrives —
  // so the panel keeps its placeholder over an image that has been ready the
  // whole time. The callback ref runs with the element in hand and can just ask.
  const frameRef = (el) => { if (el && el.complete && el.naturalWidth > 0) setFrameReady(true) }
  const [hover, setHover] = useState(null)

  if (!cam) return null

  const scene = sceneFor(cam.view)
  const found = detectionsFor(cam)
  const offline = cam.status === 'Offline'
  const tone = offline ? RED : cam.status === 'Degraded' ? AMBER : GREEN
  const mine = alerts.filter((a) => a.camera === cam.name)

  return (
    <Modal
      open
      onClose={onClose}
      title={cam.name}
      subtitle={`${cam.view} · ${cam.location_name}`}
      width={860}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={styles.frame}>
          {!offline && (
            <img
              ref={frameRef}
              src={scene.file}
              alt={`${cam.view} — illustrative reference frame`}
              onLoad={() => setFrameReady(true)}
              onError={() => setFrameReady(false)}
              style={{ ...styles.img, opacity: frameReady ? 1 : 0 }}
            />
          )}
          {(offline || !frameReady) && (
            <div style={{ ...styles.fallback, position: 'absolute', inset: 0, background: offline ? '#e2e8f0' : undefined }}>
              <span style={{ fontSize: 12, color: offline ? '#64748b' : 'rgba(226,232,240,0.85)', textAlign: 'center', lineHeight: 1.6, padding: 20 }}>
                {offline
                  ? 'Camera offline — no results since the last heartbeat'
                  : `No reference frame for this view yet — drop one at ${scene.file}.`}
              </span>
            </div>
          )}

          {/* Boxes ride the same normalised coordinates the prompts fixed, so
              they land on the thing they name rather than near it. */}
          {!offline && frameReady && found.map((d, i) => {
            const [x, y, w, h] = d.box
            const c = SEVERITY_COLOR[d.severity] || ACCENT
            const lit = hover === null || hover === i

            // The label sits above its box, except where there is no above. The
            // smoke detection on the switchgear camera starts 1.6% down the
            // frame, so its caption was drawn off the top and clipped away by
            // the frame's own overflow — a box with no name on it. Too close to
            // the top and the label moves inside; too close to the right edge
            // and it anchors to the box's right instead, since a caption can be
            // wider than the thing it names.
            const nearTop = y < 0.10
            const nearRight = x + w > 0.72
            const label = {
              ...styles.boxLabel,
              background: c,
              ...(nearTop ? { top: 2 } : { top: -19 }),
              ...(nearRight ? { right: -2 } : { left: -2 }),
            }

            return (
              <div
                key={d.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  position: 'absolute',
                  left: `${x * 100}%`, top: `${y * 100}%`,
                  width: `${w * 100}%`, height: `${h * 100}%`,
                  border: `2px solid ${c}`, borderRadius: 3,
                  boxShadow: lit ? `0 0 0 9999px rgba(2,6,23,${hover === i ? 0.42 : 0})` : 'none',
                  opacity: lit ? 1 : 0.35,
                  transition: 'opacity .15s, box-shadow .15s',
                  cursor: 'default',
                }}
              >
                <span style={label}>
                  {d.label} · {d.conf}%
                </span>
              </div>
            )
          })}

          {frameReady && !offline && (
            <span style={styles.illustrative}>Illustrative reference frame — not recorded footage</span>
          )}
          <span style={styles.camName}>{cam.name}</span>
          <span style={{ position: 'absolute', top: 10, right: 12 }}>
            <StatusDot color={tone} pulse={!offline} />
          </span>
        </div>

        <p style={styles.caveat}>
          Frames are scored on the edge device at the camera and only the results travel — no video is
          carried into this portal. The still above is a generated reference image of this camera&apos;s
          field of view, shown so the detections have something to sit on; the boxes and confidences are
          illustrative data, not a recorded inference.
        </p>

        <div style={styles.grid}>
          <Fact k="Status" v={<StatusBadge tone={offline ? 'red' : cam.status === 'Degraded' ? 'amber' : 'green'}>{cam.status}</StatusBadge>} />
          <Fact k="Location" v={cam.location_name} />
          <Fact k="Assets in frame" v={cam.assets_covered} />
          <Fact k="Frame rate" v={`${cam.fps} fps`} />
          <Fact k="Last result" v={offline ? '—' : `${cam.last_inference_s}s ago`} />
          <Fact k="Mean confidence" v={offline ? '—' : `${cam.confidence}%`} />
          <Fact k="Inferences today" v={cam.inferences_today.toLocaleString('en-US')} />
          <Fact k="Detections in frame" v={found.length || 'None'} />
        </div>

        <Block title="What this camera watches">
          <p style={styles.body}>{scene.watches}</p>
          <p style={{ ...styles.body, color: MUTE, marginTop: 6 }}>
            <b style={{ color: SUB }}>Watch zone: </b>{scene.zone}
          </p>
        </Block>

        <Block title={`Detections in this frame (${found.length})`}>
          {found.length === 0 ? (
            <p style={{ ...styles.body, color: MUTE }}>
              {offline
                ? 'This camera is offline, so it is scoring nothing. The last result predates its current heartbeat gap.'
                : 'Nothing above threshold in the current frame.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {found.map((d, i) => (
                <div
                  key={d.label}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    ...styles.det,
                    borderLeft: `3px solid ${SEVERITY_COLOR[d.severity] || ACCENT}`,
                    background: hover === i ? '#f8fafc' : '#fff',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: INK }}>{d.label}</span>
                  <StatusBadge tone={d.severity === 'Critical' ? 'red' : d.severity === 'High' ? 'amber' : 'grey'}>
                    {d.severity}
                  </StatusBadge>
                  <span style={{ fontSize: 12, fontWeight: 700, color: SUB, width: 52, textAlign: 'right' }}>{d.conf}%</span>
                </div>
              ))}
            </div>
          )}
          {cam.status === 'Degraded' && found.length > 0 && (
            <p style={{ ...styles.body, color: '#b45309', marginTop: 8 }}>
              This camera is degraded — it is still scoring, but only its highest-severity finding is
              coming back. Treat the absence of the others as unknown rather than as clear.
            </p>
          )}
        </Block>

        <Block title={`Alerts raised by this camera (${mine.length})`}>
          {mine.length === 0 ? (
            <p style={{ ...styles.body, color: MUTE }}>Nothing has been raised from this camera in the current window.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mine.slice(0, 6).map((a) => (
                <div key={a.alert_id} style={styles.alert}>
                  <span style={{ fontWeight: 700, color: ACCENT, width: 66, flexShrink: 0, fontSize: 12 }}>{a.reference}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.type}
                  </span>
                  <span style={{ fontSize: 11.5, color: MUTE, flexShrink: 0 }}>{a.asset_name}</span>
                  <StatusBadge>{a.status}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Block>
      </div>
    </Modal>
  )
}

function Fact({ k, v }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.factK}>{k}</div>
      <div style={styles.factV}>{v}</div>
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div>
      <div style={styles.blockTitle}>{title}</div>
      {children}
    </div>
  )
}

const styles = {
  frame: {
    position: 'relative', width: '100%', aspectRatio: '16 / 9',
    borderRadius: 10, overflow: 'hidden', background: '#0f172a',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  fallback: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'repeating-linear-gradient(135deg,#0f172a 0px,#0f172a 12px,#131d33 12px,#131d33 24px)',
  },
  // Anchoring is set per box in the render — see the nearTop / nearRight
  // reasoning there. This holds only what every label shares.
  boxLabel: {
    position: 'absolute', whiteSpace: 'nowrap',
    padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, color: '#fff',
  },
  illustrative: {
    position: 'absolute', bottom: 9, left: 10, padding: '3px 8px', borderRadius: 999,
    background: 'rgba(2,6,23,0.66)', color: '#e2e8f0', fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
  },
  camName: {
    position: 'absolute', top: 9, left: 11, fontSize: 10.5, fontWeight: 700,
    letterSpacing: 0.4, color: '#e2e8f0', textShadow: '0 1px 3px rgba(2,6,23,0.8)',
  },
  caveat: {
    margin: 0, padding: '10px 13px', borderRadius: 9, background: '#f8fafc',
    fontSize: 11.5, color: SUB, lineHeight: 1.6, borderLeft: '3px solid #cbd5e1',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
    gap: 12, padding: '12px 14px', borderRadius: 10, background: '#f8fafc',
  },
  factK: { fontSize: 10, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  factV: { fontSize: 13, fontWeight: 700, color: INK },
  blockTitle: { fontSize: 12, fontWeight: 800, color: INK, marginBottom: 8, letterSpacing: 0.2 },
  body: { margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6 },
  det: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
    borderRadius: 8, borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    transition: 'background .12s',
  },
  alert: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px',
    borderRadius: 8, background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
}
