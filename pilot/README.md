# Mavic 3 Enterprise mission bridge

This folder runs on the machine next to the RC, not in the browser.

```bash
git clone -b drone https://github.com/ramupadhayay/oxmaint-portal-dhl-deploy.git
cd oxmaint-portal-dhl-deploy
python3 pilot/bridge.py
curl -s -X POST localhost:8788/mission \
  -H 'content-type: application/json' \
  -d '{"text":"Collect images at the tank farm"}'
```

It writes `pilot/out/template.kml`. Zip that as `wpmz/template.kml` inside a `.kmz` and import it in DJI Pilot 2. The file declares aircraft enum 77 and the Mavic 3E camera, payload 66. Say "use the thermal camera" before the photo order for a Mavic 3T, payload 67.

The script does not connect to the aircraft. Pilot 2 is what loads the mission onto the Mavic.
