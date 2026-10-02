// xAI grok-voice session for the R1 EDU line. Tools run in-process.
// A new Twilio number points at /api/voice/twilio/incoming on this deployment.
// Do not reuse the DHL CVG number.

import { VOICE_NAME } from './agent.js'
import { spokenBrief } from '../../components/industries/oxmaint/lib/humanoid/catalog.js'

export const HUMANOID_KEYTERMS = [
  'Oxmaint',
  'R1',
  'EDU',
  'Unitree',
  'jaw',
  'jaw gun',
  'quality',
  'carton',
  'reject',
  'dock',
  'waypoint',
  'filler',
  'kit',
  'work order',
  'USB',
  'elbow',
  'look down',
  'Jetson',
  'strafe',
]

const TOOLS = [
  {
    type: 'function',
    name: 'stage_robot_command',
    description: 'Turn one spoken order into Unitree R1 EDU steps. Call this for every move, stop, jaw, joint, USB picture, kit, waypoint, or shift walk. Then say the say field. Do not invent joint indexes.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The order in the caller’s words.' },
      },
      required: ['text'],
    },
  },
  {
    type: 'function',
    name: 'run_quality_inspection',
    description: 'Judge the filler outfeed against SPEC-UHT-200. A passing carton stays on the belt. A failing carton is a jaw pick into the reject bin. Omit unit_id to run every frame on the station.',
    parameters: {
      type: 'object',
      properties: {
        unit_id: { type: 'string', description: 'Optional carton id, for example CTN-1902.' },
      },
    },
  },
  {
    type: 'function',
    name: 'list_robot_commands',
    description: 'Read the speakable order list when the caller asks what they can say, or what the robot can do. Speak that list. Do not add orders that are not in it.',
    parameters: { type: 'object', properties: {} },
  },
]

export function humanoidInstructions() {
  return [
    'You are the Oxmaint AI voice on a plant floor with one Unitree R1 EDU.',
    'Speak in second person. Keep turns short.',
    'Every physical order must go through stage_robot_command, run_quality_inspection, or list_robot_commands before you confirm it. Then speak the say field. Do not invent joint numbers, velocities, or carton results.',
    `Orders you can follow: ${spokenBrief()}.`,
    'Joints you may set by speech are the arm SDK joints only: left and right shoulder pitch, roll, and yaw, left and right elbow, left and right wrist, waist yaw, head pitch, head yaw. Example: set left elbow to 1.2. Look down, look up, look left, and look right move the head. Turn the waist left or right moves waist yaw, not the feet.',
    'Walk forward, back up, turn left, turn right, and strafe left or right are sport velocity. Stop zeros it.',
    'The USB camera is plugged into the Jetson Orin NX, device /dev/video0. It is not a DDS camera. Say take a picture with the USB camera, or inspect the line with the USB camera, when they want that feed.',
    'Quality inspection is SPEC-UHT-200, a 200 ml UHT nutrition carton, at the filler outfeed. If a carton fails seal, fill, cap, label, or the window, the robot jaw-picks it off the belt into the reject bin. A pass stays on the line and the jaw stays open.',
    'Jaw and jaw gun mean the parallel jaw on the right wrist. It is not one of the 26 joints. Open is 110 mm. A grip is 62 mm.',
    'You do not move the robot from this call. Say that the Jetson on the robot publishes the steps: arm on rt/arm_sdk, walking as sport velocity, jaw as the wrist tool.',
    'This is a synthetic station, not a live release record and not the DHL shop. Do not talk about belt loaders, GSE, or CVG.',
    'If they ask for the phone number, it is the R1 EDU line, not the DHL shop number.',
  ].join(' ')
}

export function humanoidSessionUpdate() {
  return {
    type: 'session.update',
    session: {
      voice: VOICE_NAME,
      instructions: humanoidInstructions(),
      turn_detection: { type: 'server_vad', silence_duration_ms: 600 },
      audio: {
        input: {
          format: { type: 'audio/pcmu' },
          transcription: { language_hint: 'en', keyterms: HUMANOID_KEYTERMS },
        },
        output: { format: { type: 'audio/pcmu' } },
      },
      tools: TOOLS,
    },
  }
}

export function humanoidGreeting() {
  return {
    type: 'response.create',
    response: {
      instructions: 'Greet briefly as Oxmaint AI for the R1 EDU on the plant floor. Invite one order: quality inspection, the jaw, a kit, a waypoint photo, or the shift walk. Do not list joint numbers.',
    },
  }
}

export const HUMANOID_TOOL_NAMES = ['stage_robot_command', 'run_quality_inspection', 'list_robot_commands']
