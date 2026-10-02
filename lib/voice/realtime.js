/**
 * Shared xAI realtime session: session.update, MCP function calls, optional Twilio μ-law bridge.
 */

import WebSocket from 'ws'
import { greetingCreate, sessionUpdatePayload, VOICE_REALTIME_URL } from './agent.js'
import { humanoidGreeting, humanoidSessionUpdate, HUMANOID_TOOL_NAMES } from './humanoidAgent.js'
import { isHumanoidPack } from './phone.js'
import { executeHumanoidTool } from '../../components/industries/oxmaint/lib/humanoid/commands.js'
import { invokeMcpTool, parseToolArguments } from './mcpClient.js'
import { twilioClear, twilioMediaOut } from './twilio.js'
import { getActiveRole, resetVoiceRole } from '../dhl-gse/roles.js'
import { resetVoiceOverlays } from '../dhl-gse/session.js'
import { resetSapMirror } from '../dhl-gse/sapMirror.js'

const OPEN_TIMEOUT_MS = 12_000

export function xaiHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` }
}

export async function openXaiSocket(url, apiKey, WebSocketImpl) {
  const WS = WebSocketImpl || WebSocket
  if (!WS) {
    throw new Error('WebSocket is not available. Install the ws package.')
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const socket = new WS(url, { headers: xaiHeaders(apiKey) })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {
        /* ignore */
      }
      reject(new Error('xAI realtime connect timed out'))
    }, OPEN_TIMEOUT_MS)
    const onOpen = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(socket)
    }
    const onError = (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error('xAI realtime socket error'))
    }
    socketOn(socket, 'open', onOpen)
    socketOn(socket, 'error', onError)
  })
}

function sendJson(socket, payload) {
  if (!socket || socket.readyState !== 1) return
  socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
}

function socketOn(socket, event, handler) {
  if (typeof socket.on === 'function') {
    socket.on(event, handler)
    return
  }
  const name = event === 'message' ? 'onmessage' : event === 'close' ? 'onclose' : event === 'error' ? 'onerror' : `on${event}`
  socket[name] = handler
}

function readMessageData(data) {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  if (data.data) return readMessageData(data.data)
  return String(data)
}

export async function runRealtimeSession({
  apiKey,
  url = VOICE_REALTIME_URL,
  mcpUrl,
  mcpKey,
  twilioWs = null,
  getStreamSid = () => null,
  onLog = () => {},
  WebSocketImpl,
}) {
  resetVoiceRole()
  resetVoiceOverlays()
  resetSapMirror()
  const humanoid = isHumanoidPack()
  const xai = await openXaiSocket(url, apiKey, WebSocketImpl)
  sendJson(xai, humanoid ? humanoidSessionUpdate({ mcpUrl, mcpKey }) : sessionUpdatePayload({ mcpUrl, mcpKey }))
  sendJson(xai, humanoid ? humanoidGreeting() : greetingCreate())

  const pending = new Map()
  let flushTimer = null

  async function flushTools() {
    flushTimer = null
    const jobs = [...pending.values()]
    pending.clear()
    if (!jobs.length) return
    await Promise.all(
      jobs.map(async (job) => {
        const result = humanoid && HUMANOID_TOOL_NAMES.includes(job.name)
          ? executeHumanoidTool(job.name, job.args)
          : await invokeMcpTool(job.name, job.args, { mcpUrl, mcpKey })
        sendJson(xai, {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: job.callId,
            output: JSON.stringify(result),
          },
        })
      }),
    )
    sendJson(xai, { type: 'response.create' })
  }

  function queueTool(event) {
    const callId = event.call_id || event.callId
    const name = event.name
    if (!callId || !name) return
    const args = parseToolArguments(event.arguments)
    const active = getActiveRole()
    if (active && !args.access_code && !args.spoken_code && !args.role) {
      args.access_code = active.code
    }
    pending.set(callId, { callId, name, args })
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTools().catch((err) => onLog('tool_error', err?.message || String(err)))
    }, 25)
  }

  socketOn(xai, 'message', (raw) => {
    let event
    try {
      event = JSON.parse(readMessageData(raw))
    } catch {
      return
    }
    const type = event?.type
    if (type === 'response.function_call_arguments.done') {
      queueTool(event)
      return
    }
    if (type === 'input_audio_buffer.speech_started') {
      const sid = getStreamSid()
      if (twilioWs && sid) sendJson(twilioWs, twilioClear(sid))
      return
    }
    if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
      const sid = getStreamSid()
      const delta = event.delta || event.audio
      if (twilioWs && sid && delta) sendJson(twilioWs, twilioMediaOut(sid, delta))
      return
    }
    if (type === 'error') {
      onLog('xai_error', event.error?.message || event.message || 'xAI error')
    }
  })

  const closed = new Promise((resolve) => {
    socketOn(xai, 'close', () => resolve('xai_close'))
    socketOn(xai, 'error', () => resolve('xai_error'))
  })

  function forwardTwilioAudio(payloadB64) {
    if (!payloadB64) return
    sendJson(xai, { type: 'input_audio_buffer.append', audio: payloadB64 })
  }

  function close() {
    if (flushTimer) clearTimeout(flushTimer)
    try {
      if (xai.readyState === 1) xai.close()
    } catch {
      /* ignore */
    }
  }

  return { xai, closed, forwardTwilioAudio, close, send: (payload) => sendJson(xai, payload) }
}

export async function handleTwilioMediaSocket(twilioWs, opts) {
  let streamSid = null
  let session = null
  let starting = null

  async function ensureSession() {
    if (session) return session
    if (starting) return starting
    starting = runRealtimeSession({
      ...opts,
      twilioWs,
      getStreamSid: () => streamSid,
    })
      .then((s) => {
        session = s
        s.closed.then(() => {
          try {
            twilioWs.close()
          } catch {
            /* ignore */
          }
        })
        return s
      })
      .catch((err) => {
        starting = null
        opts.onLog?.('session_error', err?.message || String(err))
        throw err
      })
    return starting
  }

  socketOn(twilioWs, 'message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(readMessageData(raw))
    } catch {
      return
    }
    const event = msg?.event
    if (event === 'start') {
      streamSid = msg.streamSid || msg.start?.streamSid || streamSid
      try {
        await ensureSession()
      } catch {
        try {
          twilioWs.close()
        } catch {
          /* ignore */
        }
      }
      return
    }
    if (event === 'media') {
      streamSid = msg.streamSid || streamSid
      const payload = msg.media?.payload
      try {
        const s = await ensureSession()
        s.forwardTwilioAudio(payload)
      } catch {
        /* session failed */
      }
      return
    }
    if (event === 'stop' || event === 'closed') {
      session?.close()
    }
  })

  socketOn(twilioWs, 'close', () => session?.close())
  socketOn(twilioWs, 'error', () => session?.close())
}

export { VOICE_REALTIME_URL }
