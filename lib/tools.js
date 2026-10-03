import { isDronePack, isHumanoidPack } from './voice/phone.js'
import * as dhl from './dhl-gse/tools.js'
import * as humanoid from './humanoid/mcpTools.js'
import * as drone from './drone/mcpTools.js'

function pack() {
  if (isDronePack()) return drone
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
