// Spoken or typed orders → the payload the Jetson publishes.
// Same function for the test URL, the portal, and the xAI voice tool.

import { KITS, WAYPOINTS, WALK } from './workflows'
import { SPEC, inspectStation } from './quality'
import { POSES, armCommand, jawCommand, velocityCommand } from './sdk'

function step(label, publish) {
  return { label, publish }
}

function reply(intent, say, steps, extra = {}) {
  return {
    ok: true,
    understood: true,
    intent,
    say,
    steps,
    sdk_note: 'The Jetson publishes these. This response does not open a DDS socket.',
    ...extra,
  }
}

function unknown(text) {
  return {
    ok: true,
    understood: false,
    intent: 'unknown',
    say: 'I can run the quality inspection, open or close the jaw, walk, stop, pick a kit, go to a waypoint, or start the shift walk. Say one of those.',
    steps: [],
    heard: text,
  }
}

function findKit(text) {
  const hit = text.match(/\b(\d{4})\b/)
  if (hit) {
    const job = KITS.find((row) => row.id.endsWith(hit[1]))
    if (job) return job
  }
  return KITS.find((row) => text.includes(row.id.toLowerCase())) || null
}

function kitSteps(job) {
  const steps = [step('Leave the dock', velocityCommand(0.2, 0, 0, 2))]
  for (const line of job.lines) {
    const short = line.onHand < line.need
    steps.push(step(
      short ? `Bin ${line.bin} is short for ${line.part}. Do not close the jaw.` : `At bin ${line.bin}, close the jaw on ${line.part}.`,
      short ? { ...jawCommand('open'), bin: line.bin, part: line.part, result: 'short' } : jawCommand('close'),
    ))
    if (!short) steps.push(step(`${line.part} in the gripper`, armCommand(POSES.lift, 1)))
  }
  steps.push(step('Back to the dock', velocityCommand(-0.2, 0, 0, 2)))
  steps.push(step('Arms home', armCommand(POSES.home, 1)))
  return steps
}

function waypointFrom(text) {
  if (/\bfiller\b|\bjaw station\b/.test(text)) return WAYPOINTS.find((row) => row.id === 'WP-FILL')
  if (/\buht|hold tube\b/.test(text)) return WAYPOINTS.find((row) => row.id === 'WP-UHT')
  if (/\bcip\b/.test(text)) return WAYPOINTS.find((row) => row.id === 'WP-CIP')
  if (/\bpanel|electrical|cabinet\b/.test(text)) return WAYPOINTS.find((row) => row.id === 'WP-ELEC')
  return null
}

export function interpretCommand(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return unknown('')

  if (/\b(stop|halt|freeze|stand still)\b/.test(text)) {
    return reply('stop', 'Stopping. Velocity zero. Arms stay where they are.', [
      step('Stop', velocityCommand(0, 0, 0, 1)),
    ])
  }

  if (/\bopen\b/.test(text) && /\bjaw\b/.test(text)) {
    return reply('jaw_open', 'Opening the jaw to 110 mm. It is the wrist tool, not a joint on the R1 EDU.', [
      step('Open the jaw', jawCommand('open')),
    ])
  }

  if (/\bclose\b/.test(text) && /\bjaw\b/.test(text) && !/\bquality|inspect|carton|spec\b/.test(text)) {
    return reply('jaw_close', 'Closing the jaw to 62 mm on whatever is in the right hand.', [
      step('Present the wrist', armCommand(POSES.reach, 1)),
      step('Close the jaw', jawCommand('close')),
    ])
  }

  if (/\bquality|q\.?a\b|\bcarton|out of spec|specification|\bspec\b|\bfaulty|reject|off the line\b/.test(text) || /\bpick\b.*\boff\b/.test(text)) {
    const named = text.match(/ctn[-\s]?(\d{4})/i)
    const unitId = named ? `CTN-${named[1]}` : ''
    const station = inspectStation(unitId)
    return { ...station, sdk_note: 'The Jetson publishes these. This response does not open a DDS socket.' }
  }

  if (/\bkit|spare|stores?\b|\bwork order\b|\bwo\b/.test(text)) {
    const job = findKit(text) || KITS[0]
    const short = job.lines.filter((line) => line.onHand < line.need)
    const say = short.length
      ? `${job.id}: I will pick what is on the shelf. ${short.map((line) => line.part).join(', ')} is short, so the jaw stays open on that bin.`
      : `${job.id}: every line is on the shelf. I will jaw-pick the kit and bring it back.`
    return reply('kit', say, kitSteps(job), { work_order: job.id })
  }

  if (/\bshift|walkthrough|end of shift\b/.test(text)) {
    const abnormal = WALK.filter((point) => point.kind)
    return reply(
      'shift_walk',
      `Walking the end of shift. ${abnormal.map((point) => `${point.place} opens a ${point.kind.toLowerCase()} request`).join('. ')}.`,
      [
        step('Leave the dock', velocityCommand(0.2, 0, 0, 3)),
        ...abnormal.map((point) => step(`Note ${point.place}`, {
          camera: 'head',
          action: 'capture',
          place: point.place,
          request: point.kind,
        })),
        step('Return to the dock', velocityCommand(-0.2, 0, 0, 3)),
      ],
    )
  }

  if (/\bdock|go home|return\b/.test(text)) {
    return reply('return_dock', 'Coming back to the dock. Arms home, jaw open.', [
      step('Open the jaw', jawCommand('open')),
      step('Walk to the dock', velocityCommand(-0.2, 0, 0, 3)),
      step('Arms home', armCommand(POSES.home, 1)),
    ])
  }

  if (/\bturn\b/.test(text)) {
    const left = /\bleft\b/.test(text) || !/\bright\b/.test(text)
    const yaw = left ? 0.4 : -0.4
    return reply('turn', left ? 'Turning left. Positive vyaw.' : 'Turning right. Negative vyaw.', [
      step(left ? 'Turn left' : 'Turn right', velocityCommand(0, 0, yaw, 1.5)),
    ])
  }

  if (/\b(walk|forward|ahead|back up|backward|come here)\b/.test(text)) {
    const back = /\bback/.test(text)
    return reply(back ? 'back' : 'walk', back ? 'Backing up.' : 'Walking forward.', [
      step(back ? 'Back up' : 'Walk forward', velocityCommand(back ? -0.2 : 0.2, 0, 0, 2)),
    ])
  }

  if (/\b(inspect|photo|picture|waypoint|go to)\b/.test(text)) {
    const point = waypointFrom(text)
    if (point && !point.ready) {
      return reply('inspect_blocked', `${point.name} has no pose, so I will not leave the dock.`, [], { waypoint: point.id })
    }
    if (point) {
      return reply('inspect', `Going to ${point.name}. I will take the picture and come back. The jaw stays open.`, [
        step(`Walk to ${point.name}`, velocityCommand(0.2, 0, 0, 3)),
        step('Look and photograph', armCommand(POSES.look, 1)),
        step('Capture', { camera: 'head', action: 'capture', waypoint: point.id, pose: point.pose }),
        step('Return to the dock', velocityCommand(-0.2, 0, 0, 3)),
      ], { waypoint: point.id })
    }
    if (/\bline\b/.test(text)) {
      const station = inspectStation()
      return { ...station, sdk_note: 'The Jetson publishes these. This response does not open a DDS socket.' }
    }
  }

  return unknown(text)
}

export function executeHumanoidTool(name, args = {}) {
  if (name === 'run_quality_inspection') return inspectStation(args.unit_id || args.unit || '')
  if (name === 'stage_robot_command') return interpretCommand(args.text || args.utterance || args.command || '')
  return { ok: false, understood: false, say: 'That tool is not on this robot.', steps: [] }
}

export const COMMAND_EXAMPLES = [
  'Run quality inspection and pick the faulty cartons off the line',
  'Check carton CTN-1902',
  'Close the jaw gun',
  'Open the jaw',
  'Walk forward',
  'Stop',
  'Pick the kit for work order 2614',
  'Inspect the filler jaw',
  'Start the end of shift walk',
  'Return to the dock',
]

export { SPEC }
