import { executeHumanoidTool } from '../../components/industries/oxmaint/lib/humanoid/commands.js'

export const MCP_SERVER_INFO = {
  name: 'oxmaint-autonomous-units',
  version: '0.1.0',
}

const TOOLS = {
  stage_robot_command: {
    description:
      'Turn one spoken order into Unitree R1 EDU steps. Use for every move, stop, jaw, joint, USB picture, kit, waypoint, or shift walk. Speak the say field. Do not invent joint indexes.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The order in the caller’s words.' },
      },
      required: ['text'],
    },
  },
  run_quality_inspection: {
    description:
      'Judge the filler outfeed against SPEC-UHT-200. A passing carton stays on the belt. A failing carton is a jaw pick into the reject bin.',
    inputSchema: {
      type: 'object',
      properties: {
        unit_id: { type: 'string', description: 'Optional carton id, for example CTN-1902.' },
      },
    },
  },
  list_robot_commands: {
    description: 'Read the speakable order list. Speak that list. Do not add orders that are not in it.',
    inputSchema: { type: 'object', properties: {} },
  },
}

export function listToolDescriptors() {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
}

export async function callTool(name, args = {}) {
  if (!TOOLS[name]) return { ok: false, error: `unknown tool: ${name}` }
  return executeHumanoidTool(name, args || {})
}
