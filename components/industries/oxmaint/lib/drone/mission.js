// DJI Mavic 3 Enterprise voice missions.
// Numbers are the WPML enums in DJI Cloud API common elements:
// aircraft 77, M3E sub 0 payload 66, M3T sub 1 payload 67, M3M sub 2 payload 68.
// Coordinates are a sample yard. Replace them before a Pilot 2 upload.
// This module does not open a link to the aircraft.

export const AIRCRAFT = {
  m3e: { id: 'm3e', name: 'Mavic 3 Enterprise', droneEnum: 77, droneSub: 0, payloadEnum: 66, camera: 'Mavic 3E Camera' },
  m3t: { id: 'm3t', name: 'Mavic 3 Thermal', droneEnum: 77, droneSub: 1, payloadEnum: 67, camera: 'Mavic 3T Camera' },
  m3m: { id: 'm3m', name: 'Mavic 3 Multispectral', droneEnum: 77, droneSub: 2, payloadEnum: 68, camera: 'Mavic 3M Camera' },
}

export const HOME = { id: 'home', name: 'home pad', lat: 46.72, lng: 6.53, height: 0 }

export const PLACES = [
  { id: 'roof-north', name: 'roof north', lat: 46.7204, lng: 6.5302, height: 40 },
  { id: 'tank-farm', name: 'tank farm', lat: 46.7202, lng: 6.5308, height: 35 },
  { id: 'filler-roof', name: 'filler roof', lat: 46.7198, lng: 6.5305, height: 30 },
  { id: 'perimeter-south', name: 'perimeter south', lat: 46.7195, lng: 6.5301, height: 45 },
  { id: 'dock-yard', name: 'dock yard', lat: 46.7201, lng: 6.5296, height: 25 },
]

export const SPOKEN = [
  { say: 'New waypoint at the filler roof' },
  { say: 'Collect images at the tank farm' },
  { say: 'Collect details at the dock yard' },
  { say: 'Fly the yard mission' },
  { say: 'Send the mission' },
  { say: 'Go to roof north' },
  { say: 'Return home' },
  { say: 'Hover' },
  { say: 'Use the thermal camera' },
  { say: 'What can I say' },
]

const NOTE = 'Sample yard. DJI Pilot 2 on the RC imports this WPML mission. This response does not connect to the Mavic.'

function xml(value) {
  return String(value).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}

function placeFrom(text) {
  const hit = PLACES.find((place) => text.includes(place.name))
  if (hit) return hit
  if (/\bhome\b/.test(text)) return { ...HOME, height: 20 }
  return null
}

function aircraftFrom(text) {
  if (/\bthermal|m3t\b/.test(text)) return AIRCRAFT.m3t
  if (/\bmultispectral|m3m\b/.test(text)) return AIRCRAFT.m3m
  return AIRCRAFT.m3e
}

function point(place, action) {
  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    height: place.height,
    speed: 5,
    gimbalPitch: action === 'goto' ? -45 : -90,
    action,
  }
}

export function templateKml(mission) {
  const craft = mission.aircraft
  const points = mission.waypoints.map((wp, index) => {
    const actions = []
    actions.push(`<wpml:action><wpml:actionId>0</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${wp.gimbalPitch}</wpml:gimbalPitchRotateAngle><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>`)
    if (wp.action === 'photo' || wp.action === 'details') {
      actions.push(`<wpml:action><wpml:actionId>1</wpml:actionId><wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:fileSuffix>${xml(wp.id)}</wpml:fileSuffix><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>`)
    }
    if (wp.action === 'details' || wp.action === 'hover') {
      actions.push(`<wpml:action><wpml:actionId>2</wpml:actionId><wpml:actionActuatorFunc>hover</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:hoverTime>3</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>`)
    }
    return `<Placemark><Point><coordinates>${wp.lng},${wp.lat}</coordinates></Point><wpml:index>${index}</wpml:index><wpml:ellipsoidHeight>${wp.height}</wpml:ellipsoidHeight><wpml:height>${wp.height}</wpml:height><wpml:waypointSpeed>${wp.speed}</wpml:waypointSpeed><wpml:actionGroup><wpml:actionGroupId>${index}</wpml:actionGroupId><wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex><wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex><wpml:actionGroupMode>sequence</wpml:actionGroupMode><wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>${actions.join('')}</wpml:actionGroup></Placemark>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>Oxmaint AI</wpml:author>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>${mission.finish}</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
    <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
    <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>${craft.droneEnum}</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>${craft.droneSub}</wpml:droneSubEnumValue>
    </wpml:droneInfo>
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${craft.payloadEnum}</wpml:payloadEnumValue>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:payloadInfo>
  </wpml:missionConfig>
  <Folder>
    <wpml:templateType>waypoint</wpml:templateType>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
    </wpml:waylineCoordinateSysParam>
    ${points}
  </Folder>
</Document>
</kml>`
}

function pack(intent, say, waypoints, text, finish = 'goHome') {
  const aircraft = aircraftFrom(text)
  const mission = {
    aircraft,
    finish,
    waypoints,
    sample: true,
  }
  return {
    ok: true,
    intent,
    say,
    aircraft: aircraft.name,
    camera: aircraft.camera,
    drone_enum: aircraft.droneEnum,
    drone_sub_enum: aircraft.droneSub,
    payload_enum: aircraft.payloadEnum,
    waypoints,
    finish,
    template_kml: waypoints.length ? templateKml(mission) : '',
    sdk_note: NOTE,
  }
}

export function interpretMission(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return { ok: false, intent: 'empty', say: 'Say a mission order.', waypoints: [], sdk_note: NOTE }

  if (/\b(what can i say|list commands|what can you do)\b/.test(text)) {
    return pack('catalog', SPOKEN.map((row) => row.say).join('. '), [], text, 'goHome')
  }

  if (/\b(return home|go home|rth|return to home)\b/.test(text)) {
    return pack('rth', 'Return home. Finish action is goHome. The Mavic flies this only after Pilot 2 loads the mission.', [point({ ...HOME, height: 20 }, 'goto')], text, 'goHome')
  }

  if (/\bhover|hold position\b/.test(text)) {
    const place = placeFrom(text) || { ...HOME, height: 20, name: 'home pad' }
    return pack('hover', `Hover for 3 seconds at ${place.name}.`, [point(place, 'hover')], text, 'goHome')
  }

  const place = placeFrom(text)
  if (/\bthermal|multispectral\b/.test(text) && !place && !/\b(images?|photos?|waypoint|mission|fly|hover)\b/.test(text)) {
    const craft = aircraftFrom(text)
    return pack('camera', `Next mission uses the ${craft.camera}. Say where to collect images.`, [], text)
  }

  const images = /\b(images?|photos?|pictures?|details?)\b/.test(text)
  const details = /\bdetail/.test(text)
  const fresh = /\bnew waypoint|add waypoint\b/.test(text)
  const send = /\bsend the mission|fly the yard|yard mission|start the mission|fly the mission\b/.test(text)

  if (send && !place) {
    return pack(
      'mission',
      'Yard mission. Five sample waypoints, one photo at each, gimbal down, then return home. Pilot 2 has to import it.',
      PLACES.map((item) => point(item, 'photo')),
      text,
    )
  }

  if (!place && (fresh || images || /\bgo to|fly to\b/.test(text))) {
    return pack('need_place', `Name a place. ${PLACES.map((item) => item.name).join(', ')}.`, [], text)
  }

  if (fresh && place) {
    return pack('waypoint', `New waypoint at ${place.name}, ${place.height} m above the pad. No photo yet.`, [point(place, 'goto')], text)
  }

  if (images && place) {
    const action = details ? 'details' : 'photo'
    const say = details
      ? `Collect details at ${place.name}. Hover 3 seconds, gimbal down, one photo.`
      : `Collect images at ${place.name}. Gimbal down, one photo, then return home.`
    return pack(action, say, [point(place, action)], text)
  }

  if (place && /\b(go to|fly to|waypoint)\b/.test(text)) {
    return pack('goto', `Go to ${place.name} at ${place.height} m. No photo.`, [point(place, 'goto')], text)
  }

  return pack('unknown', `I did not match that. ${SPOKEN.slice(0, 4).map((row) => row.say).join('. ')}.`, [], text)
}
