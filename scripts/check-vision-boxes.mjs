// Print the detection boxes exactly as the app holds them.
//
//   node scripts/check-vision-boxes.mjs
//
// Reads lib/visionScenes.js itself rather than a copy, so a box that has drifted
// from the frame it sits on cannot hide behind a stale check. Pipe the JSON into
// the drawing step to see them on the images.
import { SCENES } from '../components/industries/oxmaint/lib/visionScenes.js'

const out = Object.entries(SCENES).map(([view, s]) => ({
  view,
  file: s.file,
  detections: s.detections.map((d) => ({ label: d.label, box: d.box, severity: d.severity })),
}))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2))
} else {
  for (const s of out) {
    console.log(`\n${s.view}  ${s.file}`)
    for (const d of s.detections) {
      const [x, y, w, h] = d.box
      console.log(`  ${d.label.padEnd(34)} x ${(x * 100).toFixed(0)}%–${((x + w) * 100).toFixed(0)}%   y ${(y * 100).toFixed(0)}%–${((y + h) * 100).toFixed(0)}%`)
    }
  }
}
