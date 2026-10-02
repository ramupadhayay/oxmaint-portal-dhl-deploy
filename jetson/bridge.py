#!/usr/bin/env python3
"""R1 EDU bridge for the Jetson on the robot.

Dry-run by default: it asks the public portal for the Unitree steps and
prints them. It does not open DDS until HUMANOID_EXECUTE=1, and even then
it only writes the payload the unitree_sdk2 example would publish. The USB
camera on the NVIDIA unit is /dev/video0 unless HUMANOID_USB_CAMERA is set.

  python3 jetson/bridge.py
  curl -s localhost:8787/health
  curl -s -X POST localhost:8787/command -H 'content-type: application/json' \\
    -d '{"text":"Take a picture with the USB camera"}'
  curl -s -o frame.jpg localhost:8787/camera/usb

Public bind is off until HUMANOID_PUBLIC=1. Set HUMANOID_BRIDGE_TOKEN if the
port is reachable beyond the robot. Do not set HUMANOID_EXECUTE=1 on a
public interface.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORTAL = os.environ.get(
    'OXMAINT_COMMAND_URL',
    'https://oxmaint-portal-humanoid.vercel.app/api/humanoid/command',
)
PORT = int(os.environ.get('HUMANOID_BRIDGE_PORT', '8787'))
HOST = '0.0.0.0' if os.environ.get('HUMANOID_PUBLIC') == '1' else '127.0.0.1'
TOKEN = os.environ.get('HUMANOID_BRIDGE_TOKEN', '').strip()
EXECUTE = os.environ.get('HUMANOID_EXECUTE') == '1'
USB = os.environ.get('HUMANOID_USB_CAMERA', '/dev/video0')
NIC = os.environ.get('HUMANOID_NIC', 'eth0')


def portal_command(text):
    import urllib.request
    body = json.dumps({'text': text}).encode()
    req = urllib.request.Request(
        PORTAL,
        data=body,
        headers={'content-type': 'application/json', 'user-agent': 'oxmaint-r1-bridge'},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode())


def grab_usb():
    if not os.path.exists(USB):
        return None, f'{USB} is not on this machine'
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return None, 'ffmpeg is not installed; the device is there but no frame was taken'
    proc = subprocess.run(
        [ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'v4l2', '-i', USB, '-frames:v', '1', '-f', 'image2', 'pipe:1'],
        capture_output=True,
        timeout=8,
    )
    if proc.returncode != 0 or not proc.stdout:
        err = proc.stderr.decode('utf-8', 'replace')[-240]
        return None, err or 'the USB camera did not return a frame'
    return proc.stdout, ''


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _auth(self):
        if not TOKEN:
            return True
        header = self.headers.get('authorization', '')
        return header == f'Bearer {TOKEN}'

    def _json(self, code, payload):
        raw = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(raw)))
        self.send_header('cache-control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self._auth():
            return self._json(401, {'ok': False, 'error': 'unauthorized'})
        path = self.path.split('?', 1)[0]
        if path == '/health':
            return self._json(200, {
                'ok': True,
                'model': 'R1 EDU',
                'dof': 26,
                'sdk': 'unitree_sdk2',
                'execute': EXECUTE,
                'nic': NIC,
                'usb': USB,
                'usb_present': os.path.exists(USB),
                'public': HOST == '0.0.0.0',
                'portal': PORTAL,
            })
        if path == '/camera/usb':
            frame, err = grab_usb()
            if frame is None:
                return self._json(503, {'ok': False, 'error': err, 'device': USB})
            self.send_response(200)
            self.send_header('content-type', 'image/jpeg')
            self.send_header('content-length', str(len(frame)))
            self.send_header('cache-control', 'no-store')
            self.end_headers()
            self.wfile.write(frame)
            return
        return self._json(404, {'ok': False, 'error': 'not found'})

    def do_POST(self):
        if not self._auth():
            return self._json(401, {'ok': False, 'error': 'unauthorized'})
        if self.path.split('?', 1)[0] != '/command':
            return self._json(404, {'ok': False, 'error': 'not found'})
        length = int(self.headers.get('content-length', '0') or 0)
        raw = self.rfile.read(length) if length else b'{}'
        try:
            body = json.loads(raw.decode() or '{}')
        except json.JSONDecodeError:
            return self._json(400, {'ok': False, 'error': 'invalid JSON'})
        text = body.get('text') or body.get('utterance') or ''
        if not str(text).strip():
            return self._json(400, {'ok': False, 'error': 'Send { "text": "..." }.'})
        try:
            staged = portal_command(str(text))
        except Exception as exc:
            return self._json(502, {'ok': False, 'error': f'portal did not answer: {exc}'})
        staged['bridge'] = {
            'executed': False,
            'dry_run': not EXECUTE,
            'nic': NIC,
            'usb': USB,
            'note': 'Dry-run. Set HUMANOID_EXECUTE=1 on the Jetson to publish rt/arm_sdk, sport, and the jaw. This process still does not open a DDS socket by itself; point it at example/r1 on ' + NIC + '.',
        }
        print(json.dumps({'text': text, 'intent': staged.get('intent'), 'steps': len(staged.get('steps') or [])}))
        return self._json(200, staged)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'R1 EDU bridge on http://{HOST}:{PORT} execute={EXECUTE} usb={USB}')
    server.serve_forever()


if __name__ == '__main__':
    main()
