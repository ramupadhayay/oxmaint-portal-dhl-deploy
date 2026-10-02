import { isHumanoidPack } from './voice/phone.js'
import * as dhl from './dhl-gse/tools.js'
import * as humanoid from './humanoid/mcpTools.js'

function pack() {
  return isHumanoidPack() ? humanoid : dhl
}

export function listToolDescriptors() {
  return pack().listToolDescriptors()
}

export function callTool(name, args) {
  return pack().callTool(name, args)
}

export const MCP_SERVER_INFO = new Proxy(
  {},
  {
    get(_target, prop) {
      return pack().MCP_SERVER_INFO[prop]
    },
  },
)
