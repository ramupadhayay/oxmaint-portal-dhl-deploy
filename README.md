# Oxmaint AI — CMMS portal

A CMMS: assets, work orders, preventive maintenance, inspections, inventory,
purchasing, EHS and compliance — around 56 screens, all under
`/portal/oxmaint/<section>`, plus an admin console at `/admin`.

## Run it locally

```bash
npm install
cp .env.example .env.local     # then fill in MONGO_URI and JWT_SECRET
npm run dev                    # http://localhost:3000
```

The root redirects to `/portal/oxmaint/dashboard`.

## Deploy

One command, every time:

```powershell
npm run deploy
```

It pulls the current branch, installs, builds, then starts or restarts the
process under PM2 — and stops at the first step that fails, so a broken build
never reaches the running app. Safe to run when nothing has changed, and safe
the first time: it starts the process if PM2 has never seen it.

First time on a host:

```powershell
mkdir C:\apps\oxmaint
git clone https://github.com/jatin-ox/Oxmaint-Portal.git C:\apps\oxmaint
cd C:\apps\oxmaint
copy .env.example .env.local   # then fill it in
npm run deploy
```

Runs on port 3006 (`ecosystem.config.js`), overridable with `PORT`.

| File | |
|---|---|
| `scripts/deploy.ps1` | the whole cycle — pull, install, build, restart |
| `ecosystem.config.js` | the PM2 process definition |
| `.env.example` | what `.env.local` needs |

## Layout

```
app/
  layout.js                    root html shell
  page.js                      /  → /portal/oxmaint/dashboard
  admin/
    page.js                    /admin — console sign-in
    portals/page.js            /admin/portals — the card grid
  portal/oxmaint/
    layout.js                  server component; owns the tab title
    [section]/page.js          the router: 60+ slugs → components
  api/
    oxmaint/records/route.js   the portal's one persistence endpoint
    admin/login|logout         console sign-in

components/industries/
  oxmaint/
    components/                Shell, Sidebar, TopBar, SynapseChat, SaveToast
    lib/                       the engine — see below
    pages/                     the 56 screens
  autonomous-inspection/lib/   shared primitives oxmaint/lib/kit.jsx re-exports

lib/
  db.js                        mongoose connection, cached
  adminAuth.js                 signs and verifies the console's token
  models/                      OxmaintRecord (portal), User (console sign-in)

proxy.js                       gates /admin
```

### The engine, in short

- **`lib/packs/`** — which demo this is. A pack is only the inputs: the customer,
  their sites, asset kinds, failure modes, stores. `chiller` is active; `generic`
  is the industry-neutral default. Override with `NEXT_PUBLIC_OXMAINT_PACK`.
- **`lib/data.js`** — turns a pack into 126 assets, 84 work orders and the KPIs
  over them, through a deterministic hash. Same input, same plant, every run.
  Dates are offsets from today, so the demo does not rot.
- **`lib/store.jsx`** — the seeded plant merged with whatever anyone has created
  or changed since. A stored record with a seeded id replaces it, which is what
  lets a seeded work order be closed without copying the plant into Mongo.
- **`lib/nav.jsx`** — the menu, read by both the sidebar and the command palette.
- **`lib/kit.jsx`** — the table, filter bar, KPI strip and badges nearly every
  screen is built from.

Every file carries a header comment explaining why it is the way it is. Read
those before the code.

## Admin console

`/admin` signs in against MongoDB users whose `role` is `admin` — the same
accounts and the same passwords the portal's own database already holds, so
there is no second credential list to keep in step. The session is a JWT cookie
signed with `JWT_SECRET`; `proxy.js` verifies it on every `/admin/*` request.

`/admin/portals` lists what this deployment can open. There is one card today;
adding another is one entry in the `PORTALS` array at the top of that file. The
search box the design started with is deliberately not there — a field that
filters a single card is a control advertising it has nothing to do — and comes
back when the list is long enough to need it.

The portal itself is not gated. There is one portal here and no other customer's
data to wander into, so a sign-in in front of it would be ceremony.

## Persistence

`MONGO_URI` holds what people *do* — the work order raised, the checklist
completed, the status changed. The seeded plant is generated in the bundle and
never stored.

Without `MONGO_URI` the portal still runs: the API answers `persisted: false`,
the screens fall back to seeded data and creating a record reports that it was
not saved. Nothing crashes — that path is deliberate.
