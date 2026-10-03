import { SPOKEN } from '../../components/industries/oxmaint/lib/drone/mission.js'
import { DRONE_TOOL_NAMES } from '../../components/industries/oxmaint/lib/drone/commands.js'

export { DRONE_TOOL_NAMES }

const VOICE_NAME = 'eve'

function instructions() {
  return [
    'You are the Oxmaint AI voice for one DJI Mavic 3 Enterprise.',
    'Every mission order must call stage_drone_command, set_waypoint, collect_images, or list_drone_commands before you confirm it. Then speak the say field.',
    `Orders you can follow: ${SPOKEN.map((row) => row.say).join('. ')}.`,
    'A new waypoint, a photo, and the yard mission are WPML for DJI Pilot 2. Aircraft enum 77. M3E payload 66. Thermal is Mavic 3T, payload 67.',
    'You do not fly the aircraft from this call. Say that Pilot 2 on the RC imports the mission.',
    'Do not talk about the Unitree robot, belt loaders, or the DHL shop.',
  ].join(' ')
}

const TOOLS = [
  {
    type: 'function',
    name: 'stage_drone_command',
    description: 'Turn the spoken order into a Mavic 3 Enterprise waypoint mission.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    type: 'function',
    name: 'set_waypoint',
    description: 'Add one named waypoint.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    type: 'function',
    name: 'collect_images',
    description: 'Collect images or details at one place.',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string' },
        details: { type: 'boolean' },
      },
      required: ['place'],
    },
  },
  {
    type: 'function',
    name: 'list_drone_commands',
    description: 'Read the speakable list.',
    parameters: { type: 'object', properties: {} },
  },
]

export function droneSessionUpdate() {
  return {
    type: 'session.update',
    session: {
      voice: VOICE_NAME,
      instructions: instructions(),
      turn_detection: { type: 'server_vad', silence_duration_ms: 500 },
      tools: TOOLS,
    },
  }
}

export function droneGreeting() {
  return {
    type: 'response.create',
    response: {
      instructions: 'Say you have the Mavic 3 Enterprise. Ask which waypoint, or whether to collect images. One sentence.',
    },
  }
}
