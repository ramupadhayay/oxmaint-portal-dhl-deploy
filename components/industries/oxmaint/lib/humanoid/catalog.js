// One speakable list for the phone line, the xAI agent, and the portal.
// Phrases here are the orders interpretCommand actually accepts.

export const ROBOT = {
  model: 'R1 EDU',
  not: 'R1 Air (20 DOF) is not this bridge',
  dof: 26,
  sdk: 'unitree_sdk2',
  sdk_repo: 'https://github.com/unitreerobotics/unitree_sdk2',
  sdk_paths: [
    'include/unitree/dds_wrapper/robots/r1/defines.h',
    'example/r1/high_level/r1_arm_sdk_dds_example.cpp',
    'include/unitree/robot/r1/loco/r1_loco_api.hpp',
  ],
  topics: { arm: 'rt/arm_sdk', state: 'rt/lowstate', walk: 'sport 7105 SET_VELOCITY' },
  compute: 'Jetson Orin NX',
  usb_camera: {
    name: 'USB camera',
    where: 'USB port on the NVIDIA unit',
    device: '/dev/video0',
    env: 'HUMANOID_USB_CAMERA',
    note: 'Not a DDS camera topic. The Jetson bridge reads it as V4L2.',
  },
}

// Longer phrases first when matching a joint by speech.
export const JOINT_SAY = [
  { name: 'LeftShoulderPitch', words: 'left shoulder pitch' },
  { name: 'LeftShoulderRoll', words: 'left shoulder roll' },
  { name: 'LeftShoulderYaw', words: 'left shoulder yaw' },
  { name: 'LeftElbow', words: 'left elbow' },
  { name: 'LeftWristRoll', words: 'left wrist' },
  { name: 'RightShoulderPitch', words: 'right shoulder pitch' },
  { name: 'RightShoulderRoll', words: 'right shoulder roll' },
  { name: 'RightShoulderYaw', words: 'right shoulder yaw' },
  { name: 'RightElbow', words: 'right elbow' },
  { name: 'RightWristRoll', words: 'right wrist' },
  { name: 'WaistYaw', words: 'waist' },
  { name: 'HeadPitch', words: 'head pitch' },
  { name: 'HeadYaw', words: 'head yaw' },
]

export const SPOKEN = [
  {
    group: 'Quality',
    say: 'Run quality inspection and pick the faulty cartons off the line',
    also: ['Check carton CTN-1902', 'Inspect the line with the USB camera'],
  },
  {
    group: 'Jaw',
    say: 'Close the jaw gun',
    also: ['Open the jaw'],
  },
  {
    group: 'Walk',
    say: 'Walk forward',
    also: ['Back up', 'Turn left', 'Turn right', 'Strafe left', 'Stop'],
  },
  {
    group: 'Arms and head',
    say: 'Look down',
    also: ['Look left', 'Look up', 'Arms home', 'Reach', 'Lift', 'Set left elbow to 1.2', 'Turn the waist left'],
  },
  {
    group: 'USB camera',
    say: 'Take a picture with the USB camera',
    also: ['Use the NVIDIA camera'],
  },
  {
    group: 'Jobs',
    say: 'Pick the kit for work order 2614',
    also: ['Inspect the filler jaw', 'Start the end of shift walk', 'Return to the dock'],
  },
  {
    group: 'List',
    say: 'What can I say',
    also: [],
  },
]

export function spokenBrief() {
  return SPOKEN.filter((row) => row.group !== 'List').map((row) => `${row.group}. ${row.say}`).join('. ')
}

export function spokenLines() {
  return SPOKEN.flatMap((row) => [row.say, ...row.also])
}

export function jointBySpeech(text) {
  const hay = String(text || '').toLowerCase()
  const rows = [...JOINT_SAY].sort((a, b) => b.words.length - a.words.length)
  return rows.find((row) => hay.includes(row.words)) || null
}
