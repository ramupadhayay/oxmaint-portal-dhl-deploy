# R1 EDU bridge

Public portal (already up):

- Voice and the speakable list: https://oxmaint-portal-autonomous-units.vercel.app/portal/oxmaint/humanoid-voice
- Command point: `POST https://oxmaint-portal-autonomous-units.vercel.app/api/humanoid/command`
- Phone: +1 (408) 549-1275

This folder runs on the Jetson Orin NX in the robot. It asks that command point what to do, then (when you turn execution on) is the process that can publish `rt/arm_sdk`, sport velocity, the wrist jaw, and a frame from the USB camera plugged into the NVIDIA unit (`/dev/video0`).

The portal does not open DDS and does not see the USB camera. This process does.

## Dry-run, including on a public test machine

```bash
git clone -b humanoid https://github.com/ramupadhayay/oxmaint-portal-dhl-deploy.git
cd oxmaint-portal-dhl-deploy
python3 jetson/bridge.py
curl -s localhost:8787/health
curl -s -X POST localhost:8787/command \
  -H 'content-type: application/json' \
  -d '{"text":"What can I say"}'
curl -s -X POST localhost:8787/command \
  -H 'content-type: application/json' \
  -d '{"text":"Take a picture with the USB camera"}'
```

`HUMANOID_PUBLIC=1` binds `0.0.0.0`. Set `HUMANOID_BRIDGE_TOKEN` if anything but the robot can reach the port. Leave `HUMANOID_EXECUTE` unset until the NIC to the robot is the one in `example/r1` (`eth0` unless `HUMANOID_NIC` says otherwise).

SDK the steps are built from: [unitree_sdk2](https://github.com/unitreerobotics/unitree_sdk2), R1 EDU 26 DOF, not the 20-DOF Air. Arm topic `rt/arm_sdk`. State `rt/lowstate`. Walk is sport API `7105`. The jaw is a wrist tool, not a joint in `defines.h`. The USB camera is V4L2, not a DDS camera topic.
