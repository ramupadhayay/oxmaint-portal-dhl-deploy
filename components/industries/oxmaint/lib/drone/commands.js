import { PLACES, SPOKEN, interpretMission } from './mission.js'

export const DRONE_TOOL_NAMES = ['stage_drone_command', 'set_waypoint', 'collect_images', 'list_drone_commands']

export function listDroneCommands() {
  return {
    ok: true,
    intent: 'catalog',
    say: SPOKEN.map((row) => row.say).join('. '),
    spoken: SPOKEN.map((row) => row.say),
    places: PLACES.map((place) => place.name),
    aircraft: 'Mavic 3 Enterprise. Thermal is Mavic 3T. Multispectral is Mavic 3M.',
  }
}

export function executeDroneTool(name, args = {}) {
  if (name === 'list_drone_commands') return listDroneCommands()
  if (name === 'set_waypoint') {
    const place = args.name || args.place || args.text || ''
    return interpretMission(args.text && /\bwaypoint\b/.test(String(args.text)) ? args.text : `New waypoint at the ${place}`)
  }
  if (name === 'collect_images') {
    const place = args.place || args.name || args.text || ''
    const line = args.details ? `Collect details at the ${place}` : `Collect images at the ${place}`
    return interpretMission(args.text && /\b(images?|photos?|details?)/.test(String(args.text)) ? args.text : line)
  }
  if (name === 'stage_drone_command') return interpretMission(args.text || args.utterance || '')
  return { ok: false, error: `unknown tool: ${name}` }
}
