// Quality spec, jaw pick, and voice-to-SDK interpreter.
//
//   node scripts/verify-humanoid.mjs

import { createRequire, register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(root, 'scripts/esm-resolve-hook.mjs')))
const require = createRequire(import.meta.url)

function fail(msg) {
  console.error(`FAIL  ${msg}`)
  process.exitCode = 1
}
function ok(msg) {
  console.log(`ok    ${msg}`)
}

const { interpretCommand, executeHumanoidTool } = require(join(root, 'components/industries/oxmaint/lib/humanoid/commands.js'))
const { judgeUnit } = require(join(root, 'components/industries/oxmaint/lib/humanoid/quality.js'))

function closes(steps) {
  return JSON.stringify(steps).includes('"action":"close"')
}

const pass = judgeUnit('CTN-1901')
const leak = judgeUnit('CTN-1902')
if (!pass?.pass || closes(pass.steps)) fail('a good carton must stay on the line with the jaw open')
else ok('CTN-1901 pass, jaw stays open')
if (leak?.pass || !closes(leak.steps) || !JSON.stringify(leak.steps).includes('"action":"open"')) fail('a seal weep must close the jaw and then release')
else ok('CTN-1902 jaw pick then release')

const station = executeHumanoidTool('run_quality_inspection', {})
const bad = (station.results || []).filter((row) => !row.pass).map((row) => row.unit_id)
if (bad.join(',') !== 'CTN-1902,CTN-1903,CTN-1904,CTN-1906') fail(`station rejects ${bad.join(',')}`)
else ok('station rejects the four faulty frames')

const spoken = interpretCommand('Run quality inspection and pick the faulty cartons off the line')
if (!spoken.understood || spoken.intent !== 'quality_inspection' || !closes(spoken.steps)) fail('spoken QA did not stage a jaw pick')
else ok('spoken quality order stages the jaw pick')

const gun = interpretCommand('Close the jaw gun')
if (gun.intent !== 'jaw_close' || gun.steps.at(-1)?.publish?.width_mm !== 62) fail('jaw gun did not close to 62 mm')
else ok('jaw gun closes to 62 mm')

const stop = interpretCommand('Stop')
if (stop.steps[0]?.publish?.velocity?.join(',') !== '0,0,0') fail('stop did not zero velocity')
else ok('stop is sport velocity zero')

const kit = interpretCommand('Pick the kit for work order 2614')
if (kit.work_order !== 'WO-2614' || !JSON.stringify(kit.steps).includes('short')) fail('WO-2614 should leave the short line unpicked')
else ok('WO-2614 leaves the short plunger seal')

const blocked = interpretCommand('Inspect the CIP room')
if (blocked.intent !== 'inspect_blocked') fail('CIP without a pose should not dispatch')
else ok('CIP without a pose stays at the dock')

const mystery = interpretCommand('What is the weather')
if (mystery.understood) fail('unknown speech should not stage a move')
else ok('unknown speech stages nothing')

const listed = interpretCommand('What can I say')
if (listed.intent !== 'catalog' || !listed.say.includes('USB') || listed.steps.length) fail('the spoken list did not come back')
else ok('spoken list includes the USB camera and does not move')

const look = interpretCommand('Look down')
const head = (look.steps[0]?.publish?.motor_cmd || []).find((row) => row.name === 'HeadPitch')
if (look.intent !== 'head' || head?.q !== 0.45) fail('look down did not set head pitch')
else ok('look down is head pitch 0.45')

const elbow = interpretCommand('Set left elbow to 1.2')
const joint = (elbow.steps[0]?.publish?.motor_cmd || []).find((row) => row.name === 'LeftElbow')
if (elbow.intent !== 'joint' || joint?.q !== 1.2 || joint?.index !== 18) fail('left elbow was not index 18 at 1.2')
else ok('set left elbow to 1.2')

const usb = interpretCommand('Take a picture with the USB camera')
if (usb.intent !== 'usb_camera' || usb.steps[0]?.publish?.device !== '/dev/video0') fail('USB camera was not /dev/video0')
else ok('USB camera capture on the Jetson')

const line = interpretCommand('Inspect the line with the USB camera')
const shot = (line.steps || []).find((row) => row.publish?.action === 'capture')
if (!shot || shot.publish.camera !== 'usb') fail('line inspection did not switch to the USB camera')
else ok('line inspection can use the USB camera')

if (!process.exitCode) console.log('humanoid command checks passed')
