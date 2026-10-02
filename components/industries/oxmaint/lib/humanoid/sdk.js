// Unitree R1 EDU — the joints and topics the plant bridge actually speaks.
//
// Taken from unitree_sdk2 on main, not from a generic humanoid model:
//   include/unitree/dds_wrapper/robots/r1/defines.h
//   include/unitree/dds_wrapper/robots/r1/r1_pub.h          (ArmSdk, topic rt/arm_sdk)
//   example/r1/high_level/r1_arm_sdk_dds_example.cpp
//   include/unitree/robot/r1/loco/r1_loco_api.hpp
//
// R1 Air is 20 DOF. R1 Basic and R1 EDU are 26 DOF: 6 per leg, 2 waist,
// 5 per arm, 2 head. The index gaps (14, 20, 21, 27, 28) are in the header.
// This page does not open a DDS socket. The Jetson on the robot does.
// What leaves this portal is the command that bridge publishes.

export const SDK_REPO = 'https://github.com/unitreerobotics/unitree_sdk2'

export const EDU = {
  model: 'R1 EDU',
  dof: 26,
  airDof: 20,
  compute: 'Jetson Orin NX (R1-EDU Professional development unit)',
  arm: '5 DOF per arm',
  waist: '2 DOF (roll, yaw — no pitch)',
  head: '2 DOF',
  leg: '6 DOF',
}

export const TOPICS = {
  armCmd: 'rt/arm_sdk',
  lowState: 'rt/lowstate',
  locoService: 'sport',
}

export const LOCO = [
  { id: 7001, name: 'GET_FSM_ID' },
  { id: 7002, name: 'GET_FSM_MODE' },
  { id: 7101, name: 'SET_FSM_ID' },
  { id: 7105, name: 'SET_VELOCITY', body: '{ velocity: [vx, vy, vyaw], duration }' },
  { id: 7107, name: 'SET_SPEED_MODE' },
]

// ArmSdk::JOINTS order, with the gains from r1_arm_sdk_dds_example.cpp.
export const ARM_JOINTS = [
  { index: 15, name: 'LeftShoulderPitch', kp: 50, kd: 2 },
  { index: 16, name: 'LeftShoulderRoll', kp: 50, kd: 2 },
  { index: 17, name: 'LeftShoulderYaw', kp: 40, kd: 2 },
  { index: 18, name: 'LeftElbow', kp: 40, kd: 2 },
  { index: 19, name: 'LeftWristRoll', kp: 30, kd: 2 },
  { index: 22, name: 'RightShoulderPitch', kp: 50, kd: 2 },
  { index: 23, name: 'RightShoulderRoll', kp: 50, kd: 2 },
  { index: 24, name: 'RightShoulderYaw', kp: 40, kd: 2 },
  { index: 25, name: 'RightElbow', kp: 40, kd: 2 },
  { index: 26, name: 'RightWristRoll', kp: 30, kd: 2 },
  { index: 13, name: 'WaistYaw', kp: 50, kd: 3 },
  { index: 29, name: 'HeadPitch', kp: 15, kd: 1 },
  { index: 30, name: 'HeadYaw', kp: 15, kd: 1 },
]

export const BODY_JOINTS = [
  ['Left leg', ['LeftHipPitch', 'LeftHipRoll', 'LeftHipYaw', 'LeftKnee', 'LeftAnklePitch', 'LeftAnkleRoll'], 0],
  ['Right leg', ['RightHipPitch', 'RightHipRoll', 'RightHipYaw', 'RightKnee', 'RightAnklePitch', 'RightAnkleRoll'], 6],
  ['Waist', ['WaistRoll', 'WaistYaw'], 12],
]

// The command the Jetson publishes on rt/arm_sdk. weight 1 hands the arms to
// the SDK; weight 0 gives them back. q is radians, in ARM_JOINTS order.
export function armCommand(q, weight = 1) {
  return {
    topic: TOPICS.armCmd,
    weight,
    motor_cmd: ARM_JOINTS.map((joint, i) => ({
      index: joint.index,
      name: joint.name,
      mode: 1,
      q: Number(q[i] ?? 0),
      dq: 0,
      tau: 0,
      kp: joint.kp,
      kd: joint.kd,
    })),
  }
}

export function velocityCommand(vx, vy, vyaw, duration = 1) {
  return {
    service: TOPICS.locoService,
    api_id: 7105,
    velocity: [vx, vy, vyaw],
    duration,
  }
}

// ArmSdk order: left arm 5, right arm 5, waist yaw, head pitch, head yaw.
export const HOLD = [0, 1.57, 0, 1.57, 0, 0, -1.57, 0, -1.57, 0, 0, 0, 0]

export const POSES = {
  home: HOLD,
  look: [0, 1.4, 0, 1.4, 0, 0.25, -1.2, 0, -1.15, 0, 0, 0.45, 0],
  reach: [0, 1.2, 0, 1.2, 0, 0.9, -0.35, 0.1, -0.55, 0, 0, 0.35, 0],
  lift: [0, 1.2, 0, 1.2, 0, -0.35, -0.3, 0, -1.25, 0, 0, 0.1, 0],
}

// Parallel jaw on the right wrist. defines.h has no gripper index — R1 EDU
// is 26 DOF without this tool — so the Jetson drives it beside rt/arm_sdk.
// Spoken “jaw” and “jaw gun” are this same end-effector.
export const JAW = {
  name: 'Parallel jaw',
  spoken: 'jaw or jaw gun',
  mount: 'Right wrist. Not a joint in defines.h.',
  open_mm: 110,
  grip_mm: 62,
}

export function jawCommand(action) {
  const close = action === 'close'
  return {
    tool: 'jaw',
    action: close ? 'close' : 'open',
    width_mm: close ? JAW.grip_mm : JAW.open_mm,
    mount: JAW.mount,
  }
}

// Extra camera on the Jetson, not one of the robot's DDS cameras.
export const USB_CAMERA = {
  name: 'USB camera',
  host: 'Jetson Orin NX',
  device: '/dev/video0',
  env: 'HUMANOID_USB_CAMERA',
  note: 'V4L2 on the NVIDIA unit. The bridge opens this device. The portal does not.',
}

export function setJointCommand(name, q) {
  const index = ARM_JOINTS.findIndex((joint) => joint.name === name)
  if (index < 0) return null
  const pose = HOLD.slice()
  pose[index] = Number(q)
  return armCommand(pose, 1)
}

export function usbCapture(reason) {
  return {
    camera: 'usb',
    device: USB_CAMERA.device,
    host: USB_CAMERA.host,
    action: 'capture',
    reason,
  }
}


