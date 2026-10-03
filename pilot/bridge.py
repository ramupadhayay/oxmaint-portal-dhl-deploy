#!/usr/bin/env python3
"""RC-side bridge for a DJI Mavic 3 Enterprise mission.

It asks the portal for the WPML mission and writes template.kml.
It does not connect to the aircraft. DJI Pilot 2 on the RC imports the file.

  python3 pilot/bridge.py
  curl -s -X POST localhost:8788/mission -H 'content-type: application/json' \\
    -d '{"text":"Collect images at the tank farm"}'
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTAL = os.environ.get(
    'OXMAINT_DRONE_URL',
    'https://oxmaint-portal-drone.vercel.app/api/drone/command',
)
PORT = int(os.environ.get('DRONE_BRIDGE_PORT', '8788'))
OUT = Path(os.environ.get('DRONE_MISSION_DIR', 'pilot/out'))


def portal_mission(text):
    import urllib.request
    body = json.dumps({'text': text}).encode()
    req = urllib.request.Request(
        PORTAL,
        data=body,
        headers={'content-type': 'application/json', 'user-agent': 'oxmaint-m3e-bridge'},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _json(self, code, payload):
        raw = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split('?', 1)[0] != '/health':
            return self._json(404, {'ok': False})
        return self._json(200, {'ok': True, 'aircraft': 'Mavic 3 Enterprise', 'portal': PORTAL, 'flies': False})

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/mission':
            return self._json(404, {'ok': False})
        length = int(self.headers.get('content-length', '0') or 0)
        try:
            body = json.loads(self.rfile.read(length).decode() or '{}')
        except json.JSONDecodeError:
            return self._json(400, {'ok': False, 'error': 'invalid JSON'})
        text = body.get('text') or ''
        if not str(text).strip():
            return self._json(400, {'ok': False, 'error': 'Send { "text": "..." }.'})
        try:
            mission = portal_mission(str(text))
        except Exception as exc:
            return self._json(502, {'ok': False, 'error': f'portal did not answer: {exc}'})
        kml = mission.get('template_kml') or ''
        written = ''
        if kml:
            OUT.mkdir(parents=True, exist_ok=True)
            path = OUT / 'template.kml'
            path.write_text(kml, encoding='utf-8')
            written = str(path)
        mission['bridge'] = {
            'written': written,
            'flies': False,
            'note': 'Import template.kml with DJI Pilot 2. This process does not connect to the Mavic.',
        }
        mission.pop('template_kml', None)
        return self._json(200, mission)


if __name__ == '__main__':
    print(f'Mavic bridge on http://127.0.0.1:{PORT} flies=False')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
