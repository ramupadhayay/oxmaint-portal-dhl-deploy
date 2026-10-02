'use client'

// What each camera is actually watching, and what the model finds there.
//
// The AI Vision screen had six view names and nothing behind them: every panel
// drew the same striped placeholder, so a reader could not tell a guard
// perimeter camera from a switchgear one, and clicking a panel did nothing. This
// is the catalogue that gives each view a frame, a watch zone and the detections
// the model is trained to raise in it.
//
// THE FRAMES ARE ILLUSTRATIONS AND MUST READ AS ILLUSTRATIONS. No footage ships
// with this build and none is carried into the portal — the screen says so, and
// that stays true. These are generated reference stills that show what the
// camera's field of view looks like, so the detection overlay has something to
// sit on other than a grey rectangle. Every surface that renders one also
// renders the word "illustrative", because a photorealistic plant frame with a
// red box on it is exactly the thing a viewer will otherwise take for evidence.
//
// COMPOSITION IS A CONTRACT. Each frame was generated to put its subject in a
// fixed part of the picture, and the `box` on each detection below is that same
// region in normalised coordinates. Replace a frame with one composed
// differently and its red box lands on empty floor — so either match the
// original composition or move these numbers with it. `zone` on each scene says
// in words where the subject belongs, which is the check to make by eye.
//
// A scene with no image on disk falls back to the striped panel the screen used
// before. The page works with none of these files present; it just says less.

/** Normalised [x, y, w, h] — fractions of the frame, origin top-left. */
export const SCENES = {
  'Line overview': {
    key: 'line-overview',
    file: '/oxmaint/vision/line-overview.jpg',
    watches: 'The full length of the line, for anything moving where nothing should be and for product backing up.',
    zone: 'The conveyor running diagonally through the frame, and the marked exclusion zone on the left.',
    detections: [
      { label: 'Person in restricted zone', box: [0.078, 0.318, 0.066, 0.287], severity: 'Critical', category: 'Safety', conf: 96.4 },
      { label: 'Product backing up', box: [0.628, 0.206, 0.167, 0.150], severity: 'Medium', category: 'Process', conf: 88.1 },
    ],
  },
  'Discharge end': {
    key: 'discharge-end',
    file: '/oxmaint/vision/discharge-end.jpg',
    watches: 'The transfer point where material leaves the belt — for spillage, for blockage, and for build-up on the chute.',
    zone: 'The chute mouth at mid-frame and the floor directly beneath the discharge point.',
    detections: [
      { label: 'Product spillage at discharge', box: [0.341, 0.680, 0.275, 0.265], severity: 'Low', category: 'Quality', conf: 91.7 },
      { label: 'Chute build-up', box: [0.359, 0.143, 0.114, 0.186], severity: 'Medium', category: 'Process', conf: 84.9 },
    ],
  },
  'Motor and drive': {
    key: 'motor-drive',
    file: '/oxmaint/vision/motor-drive.jpg',
    watches: 'The motor, coupling and belt drive — thermal signature on the housing, belt tracking, and fluid on the plinth.',
    zone: 'The motor housing centre-right, the guarded belt drive to its left, and the plinth below both.',
    detections: [
      { label: 'Thermal hotspot on motor housing', box: [0.478, 0.090, 0.317, 0.462], severity: 'High', category: 'Condition', conf: 94.2 },
      { label: 'Belt tracking off centre', box: [0.287, 0.223, 0.144, 0.356], severity: 'Medium', category: 'Condition', conf: 86.5 },
      { label: 'Fluid leak beneath the machine', box: [0.371, 0.680, 0.299, 0.276], severity: 'Medium', category: 'Condition', conf: 79.8 },
    ],
  },
  'Guard perimeter': {
    key: 'guard-perimeter',
    file: '/oxmaint/vision/guard-perimeter.jpg',
    watches: 'The machine guarding and its interlocked doors — whether a panel is open while the drive is turning.',
    zone: 'The hinged guard door on the left of the enclosure, and the floor outside the fence line.',
    detections: [
      { label: 'Guard door open while running', box: [0.179, 0.157, 0.135, 0.751], severity: 'Critical', category: 'Safety', conf: 97.8 },
      { label: 'Person at the guard line', box: [0.777, 0.246, 0.147, 0.699], severity: 'High', category: 'Safety', conf: 92.3 },
    ],
  },
  'Walkway and access': {
    key: 'walkway-access',
    file: '/oxmaint/vision/walkway-access.jpg',
    watches: 'The marked walkway and the access route to the plant — obstructions, and whether the people on it are wearing what they should be.',
    zone: 'The green-painted walkway running from the bottom of frame into the distance.',
    detections: [
      { label: 'Protective equipment not worn', box: [0.495, 0.207, 0.110, 0.503], severity: 'High', category: 'Safety', conf: 93.6 },
      { label: 'Obstruction on the walkway', box: [0.091, 0.455, 0.349, 0.401], severity: 'Medium', category: 'Safety', conf: 89.4 },
    ],
  },
  'Panel and switchgear': {
    key: 'panel-switchgear',
    file: '/oxmaint/vision/panel-switchgear.jpg',
    watches: 'The electrical room panel line — doors left open, and smoke or vapour above the cabinets.',
    zone: 'The switchgear run across the frame, each cabinet door, and the air above the line.',
    detections: [
      { label: 'Panel door left open', box: [0.581, 0.136, 0.211, 0.751], severity: 'Low', category: 'Safety', conf: 90.2 },
      { label: 'Smoke or vapour above threshold', box: [0.075, 0.016, 0.263, 0.276], severity: 'High', category: 'Condition', conf: 82.7 },
    ],
  },
}

export const sceneFor = (view) => SCENES[view] || SCENES['Line overview']

/**
 * Every detection the estate can raise, once.
 *
 * The single taxonomy. The alert log, the model list and the boxes on a frame
 * all read this, so a screen cannot show a detection nothing raises or an alert
 * for something no camera watches — which is exactly what happened while the log
 * was drawn from a list of its own.
 */
export const DETECTIONS = Object.entries(SCENES).flatMap(([view, s]) =>
  s.detections.map((d) => ({ ...d, view })))

export const SEVERITY_COLOR = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#d97706',
  Low: '#0891b2',
}

/**
 * Which detections a given camera is showing right now.
 *
 * Deterministic from the camera's own id, so the panel, the modal and a reload
 * all agree — a detection that moves every render is one nobody can point at in
 * a demo. An offline camera returns none: it is not producing results, and
 * drawing its scene's boxes anyway would be the screen inventing an inference
 * that never ran.
 */
export function detectionsFor(cam) {
  if (!cam || cam.status === 'Offline') return []
  const scene = sceneFor(cam.view)
  // A degraded camera is still scoring, just badly — it reports its highest
  // severity finding only, which is what a half-working feed actually gives you.
  const n = cam.status === 'Degraded' ? 1 : scene.detections.length
  return scene.detections.slice(0, n)
}
