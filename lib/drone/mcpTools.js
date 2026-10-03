import { executeDroneTool } from '../../components/industries/oxmaint/lib/drone/commands.js'

export const MCP_SERVER_INFO = {
  name: 'oxmaint-mavic-enterprise',
  version: '0.1.0',
}

const TOOLS = {
  stage_drone_command: {
    description:
      'Turn one spoken order into a DJI Mavic 3 Enterprise WPML mission. Use for a new waypoint, image collection, a yard mission, return home, or hover. Speak the say field. Do not invent coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The order in the caller’s words.' },
      },
      required: ['text'],
    },
  },
  set_waypoint: {
    description: 'Add one named sample waypoint. Places: filler roof, tank farm, dock yard, roof north, perimeter south.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Place name, for example filler roof.' },
      },
      required: ['name'],
    },
  },
  collect_images: {
    description: 'Photo mission at one place, gimbal down. Set details true to hover 3 seconds and take the photo.',
    inputSchema: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'Place name.' },
        details: { type: 'boolean', description: 'Hover and photograph.' },
      },
      required: ['place'],
    },
  },
  list_drone_commands: {
    description: 'Read the speakable mission list. Do not add orders that are not in it.',
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
  return executeDroneTool(name, args || {})
}
