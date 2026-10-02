'use client'

// The models doing the scoring, and what each one is for.
//
// The screen reported a single "model version 4.2.1" and left it there, which
// says nothing: a plant vision estate is not one model, it is a handful of
// narrow ones — a PPE detector, a zone-intrusion detector, a thermal one — each
// trained on its own problem and each with its own accuracy and cost. Anyone
// evaluating this wants to know which models are running, what they catch, how
// well, and how much they cost per frame. That is the list.
//
// EVERY MODEL IS DEFINED BY THE DETECTIONS IT OWNS, not by a name typed beside a
// number. `detects` names labels that already exist in visionScenes.js, and the
// cameras and coverage figures are counted from that catalogue at render time —
// so a model cannot claim a detection the estate never raises, and a detection
// cannot exist with no model behind it. `auditModels()` below asserts both
// directions, and the screen shows the result rather than hiding a mismatch.
//
// The numbers are illustrative, and the screen says so where it shows them.
// Precision, recall and latency here are plausible figures for models of this
// shape, not measurements from a validation run — this build has no validation
// set and inventing one would be the most quietly convincing lie on the page.

import { SCENES } from './visionScenes'

export const MODELS = [
  {
    id: 'ppe-v4',
    name: 'PPE Compliance',
    family: 'Person attributes',
    version: '4.2.1',
    backbone: 'YOLOv8-m',
    input: '960 × 960',
    detects: ['Protective equipment not worn'],
    precision: 94.1,
    recall: 91.6,
    latencyMs: 28,
    trained: '2026-07-14',
    frames: '48,200 labelled',
    status: 'Production',
    note: 'Hard hat, hi-vis and eye protection, scored per person rather than per frame.',
  },
  {
    id: 'zone-v3',
    name: 'Restricted Zone Intrusion',
    family: 'Person tracking',
    version: '3.8.0',
    backbone: 'YOLOv8-m + ByteTrack',
    input: '1280 × 720',
    detects: ['Person in restricted zone', 'Person at the guard line'],
    precision: 96.8,
    recall: 95.2,
    latencyMs: 34,
    trained: '2026-08-02',
    frames: '61,700 labelled',
    status: 'Production',
    note: 'Tracks a person across frames before raising, so somebody walking past a line is not an intrusion.',
  },
  {
    id: 'guard-v2',
    name: 'Guard & Panel State',
    family: 'Object state',
    version: '2.4.3',
    backbone: 'ResNet-50 classifier',
    input: '640 × 640',
    detects: ['Guard door open while running', 'Panel door left open'],
    precision: 97.9,
    recall: 96.1,
    latencyMs: 12,
    trained: '2026-06-28',
    frames: '22,400 labelled',
    status: 'Production',
    note: 'Open versus closed on a fixed region. Cheap because the camera never moves.',
  },
  {
    id: 'thermal-v2',
    name: 'Thermal Anomaly',
    family: 'Radiometric',
    version: '2.1.0',
    backbone: 'U-Net segmentation',
    input: '640 × 512 (thermal)',
    detects: ['Thermal hotspot on motor housing'],
    precision: 92.4,
    recall: 88.7,
    latencyMs: 41,
    trained: '2026-05-19',
    frames: '9,800 labelled',
    status: 'Production',
    note: 'Runs on the thermal sensor pair, not the visible camera. Absolute temperature comes from the sensor; the model finds where to read it.',
  },
  {
    id: 'leak-v3',
    name: 'Leak & Spill',
    family: 'Surface anomaly',
    version: '3.0.2',
    backbone: 'SegFormer-B2',
    input: '1024 × 1024',
    detects: ['Fluid leak beneath the machine', 'Product spillage at discharge'],
    precision: 89.3,
    recall: 84.5,
    latencyMs: 56,
    trained: '2026-07-30',
    frames: '31,100 labelled',
    status: 'Production',
    note: 'The weakest of the set on recall — a thin film on wet concrete is genuinely hard, and the model is tuned to miss rather than to cry wolf.',
  },
  {
    id: 'flow-v2',
    name: 'Material Flow',
    family: 'Process anomaly',
    version: '2.6.1',
    backbone: 'Temporal CNN',
    input: '640 × 640 × 16 frames',
    detects: ['Product backing up', 'Chute build-up'],
    precision: 90.7,
    recall: 87.9,
    latencyMs: 63,
    trained: '2026-08-11',
    frames: '17,600 clips',
    status: 'Production',
    note: 'Reads a short window rather than a still: a heap on the belt is only a fault if it is not moving.',
  },
  {
    id: 'belt-v1',
    name: 'Belt Tracking',
    family: 'Component alignment',
    version: '1.9.4',
    backbone: 'Keypoint regression',
    input: '640 × 640',
    detects: ['Belt tracking off centre'],
    precision: 91.2,
    recall: 86.3,
    latencyMs: 19,
    trained: '2026-04-22',
    frames: '12,300 labelled',
    status: 'Shadow',
    note: 'Scoring alongside production but not raising alerts yet — its findings are logged and reviewed before it is switched on.',
  },
  {
    id: 'smoke-v2',
    name: 'Smoke & Vapour',
    family: 'Volumetric anomaly',
    version: '2.2.0',
    backbone: 'Temporal CNN',
    input: '960 × 540 × 24 frames',
    detects: ['Smoke or vapour above threshold'],
    precision: 86.5,
    recall: 90.8,
    latencyMs: 71,
    trained: '2026-08-25',
    frames: '8,400 clips',
    status: 'Retraining',
    note: 'Deliberately biased towards recall: a missed smoke event costs more than a false one, and steam from a wash-down is the usual false positive.',
  },
  {
    id: 'obstruction-v2',
    name: 'Walkway Obstruction',
    family: 'Object presence',
    version: '2.0.5',
    backbone: 'YOLOv8-s',
    input: '960 × 960',
    detects: ['Obstruction on the walkway'],
    precision: 93.8,
    recall: 92.1,
    latencyMs: 16,
    trained: '2026-06-09',
    frames: '19,900 labelled',
    status: 'Production',
    note: 'Anything on the marked route that was not there at commissioning, held for two minutes before it is called an obstruction.',
  },
]

export const STATUS_TONE = { Production: 'green', Shadow: 'blue', Retraining: 'amber', Retired: 'grey' }

/** Which views a model runs on, counted from the scene catalogue. */
export function viewsFor(model) {
  const owned = new Set(model.detects)
  return Object.entries(SCENES)
    .filter(([, s]) => s.detections.some((d) => owned.has(d.label)))
    .map(([view]) => view)
}

/**
 * Does the model list and the detection catalogue still agree?
 *
 * Two failures, and both are silent without this. A model naming a detection
 * nobody raises reads as coverage the estate does not have; a detection with no
 * model behind it is a box on a frame that nothing accounts for. The screen
 * renders whatever this returns rather than assuming it is empty — a list that
 * quietly drifts from the thing it describes is worse than no list.
 */
export function auditModels() {
  const raised = new Set(
    Object.values(SCENES).flatMap((s) => s.detections.map((d) => d.label)),
  )
  const claimed = new Set(MODELS.flatMap((m) => m.detects))

  return {
    claimedButNeverRaised: [...claimed].filter((l) => !raised.has(l)).sort(),
    raisedByNoModel: [...raised].filter((l) => !claimed.has(l)).sort(),
  }
}

/** Estate-wide figures, counted rather than written down. */
export function modelSummary(cameras = []) {
  const production = MODELS.filter((m) => m.status === 'Production')
  const byView = new Map()
  for (const c of cameras) byView.set(c.view, (byView.get(c.view) || 0) + 1)

  const camerasFor = (m) => viewsFor(m).reduce((n, v) => n + (byView.get(v) || 0), 0)

  return {
    total: MODELS.length,
    production: production.length,
    shadow: MODELS.filter((m) => m.status === 'Shadow').length,
    retraining: MODELS.filter((m) => m.status === 'Retraining').length,
    // What one frame costs if every production model scores it. Cameras run
    // only the models their view needs, so this is the ceiling, not the average.
    worstCaseMs: production.reduce((n, m) => n + m.latencyMs, 0),
    meanPrecision: production.length
      ? production.reduce((n, m) => n + m.precision, 0) / production.length
      : 0,
    camerasFor,
    detections: new Set(MODELS.flatMap((m) => m.detects)).size,
  }
}
