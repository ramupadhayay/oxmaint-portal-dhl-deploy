# DHL CVG GSE — voice + MCP setup

Oxmaint AI demo for the DHL Express GSE shop at Cincinnati / Northern Kentucky
(CVG). The current-period work-order counts are a **synthetic projection** at
about **1,600 jobs a month (~400 a week)** — not DHL's own records and not live
SAP. Materials and the asset tree are an **Oxmaint AI projection mirrored to
SAP MM / PM shapes** — a sync facade with last-sync and demo IDocs, not a live
ECC or S/4 connector.

## Deploy on Vercel

1. Import [OXmaint/Oxmaint-Portal](https://github.com/OXmaint/Oxmaint-Portal) (this fork).
2. In the project **Environment Variables** set the pack and secrets below.
3. Deploy. The portal is at `/portal/oxmaint`. The call card is
   `/portal/oxmaint/gse-voice`.
4. Point the existing xAI Trial Demo Support number at this deployment:
   - SIP / CreatePhoneNumberV2 webhook: `POST https://<host>/api/voice/xai/incoming`
   - Twilio Voice webhook (optional): `POST https://<host>/api/voice/twilio/incoming`

Build argument (required for this demo):

```
NEXT_PUBLIC_OXMAINT_PACK=dhl-gse
```

Local:

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_OXMAINT_PACK=dhl-gse and XAI_API_KEY
npm install
NEXT_PUBLIC_OXMAINT_PACK=dhl-gse npm run dev
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_OXMAINT_PACK` | **yes** for this demo | `dhl-gse` |
| `XAI_API_KEY` | **yes** for a live call | grok-voice realtime |
| `VOICE_DEMO_PHONE_NUMBER` | optional | Defaults to `+14156394335`. Display: **+1 (415) 639-4335** |
| `MCP_API_KEY` | production | Bearer for `POST /api/mcp`. Voice tool calls send this. |
| `MCP_AUTH_REQUIRED` | optional | `false` to leave MCP open in a private preview |
| `PINECONE_API_KEY` | optional | Semantic lookup of WO summaries |
| `PINECONE_INDEX` | optional | Defaults to `oxmaint-multi-product` |
| `PINECONE_INDEX_HOST` | with Pinecone | Index data-plane host (no `https://`) |
| `PINECONE_NAMESPACE` | optional | This pack uses **`oxmaint-dhl-gse`** |
| `MCP_SERVER_URL` | optional | Override self-URL for tool calls (else this origin `/api/mcp`) |
| `TWILIO_AUTH_TOKEN` | optional | Validates Twilio signatures |
| `XAI_WEBHOOK_SECRET` | optional | Validates xAI SIP webhooks |
| `MONGO_URI` | optional | Voice-logged requests persist to the portal Requests screen |
| `JWT_SECRET` | admin console | Same as the rest of this app |
| `BASE_PATH` | optional | e.g. `/dhl` if several packs share a domain |

xAI team / agent (already provisioned — do not recreate unless rotating):

- Team: Oxmaint AI `676b455e-4cd2-471e-a7ad-9d0f0ee29882`
- Agent: Trial Demo Support `agent_vUCrWsPyfbBA0fKf`
- Number: `+14156394335`

## Voice access codes

After the greeting, say one four-digit code. Spoken forms work
(“triple zero one”, “zero zero zero one”, “0001”). That selects persona and
tools for the rest of the call.

| Code | Role | What they can ask |
|---|---|---|
| **0001** | Technician — Alex Rivera (`TECH-0001`, Days) | Jobs assigned to them; parts needed; whether material is available or on order; where a unit sits in the SAP PM tree; own workmanship score; log a request on a named unit (belt loader `CVG-PWR-0035`) |
| **0002** | Supervisor / maintenance manager | Waterfall pipeline (planning → parts ready/short → manpower → in flow → review → archived), this week’s ~400 jobs, stage mix, hot P1 and Parts Hold, open PRs, asset hierarchy, workmanship scores, spare-variant insights, last-quarter / 6-month airline audit PDF |
| **0003** | Store / parts | Parts Hold queue, check stock, create/update PR, read PR → PO → GR, post a demo goods receipt (updates stock and clears the hold for this call only), OEM vs aftermarket variant insights |

Alex Rivera is a **demo** technician identity — not a real DHL employee.

## Voice test script

Call **+1 (415) 639-4335**. After the greeting, say a code, then:

**0001 technician**

1. What work orders are assigned to me?
2. Are the parts for [one of those WOs] in stock or on order?
3. Where does belt loader 0035 sit in the hierarchy?
4. What is my workmanship score — any come-backs?
5. Log a maintenance request on belt loader 0035 — conveyor slipping under load.

**0002 supervisor**

1. How many work orders this week?
2. How many this week are still in planning?
3. How many need a PR? How many have scope variation?
4. What’s waiting on my technical close?
5. Manpower plan for Thursday?
6. How many WOs are blocked on material, and how many open purchase requisitions this week?
7. What is Alex Rivera’s workmanship score versus the shop?
8. Which spare variants are best fit, and which drive parts hold?
9. Generate the last quarter airline audit report.
10. Where is CVG-PWR-0035 in the functional location tree?

**0003 store**

1. What is on Parts Hold this week? Check stock for the short lines.
2. What is the PR / PO / GR status on that job?
3. Which aftermarket variants are higher value versus stay-with-OEM?
4. Post a goods receipt on the PO — release the parts hold.

Expected: role-scoped answers from this repo's DHL CVG projection (~400 this week,
~1,600 this month). A technician hears their board, stock vs on-order, and a
`REQ-V…` id, not the full week plan. Store hears plant / storage-location stock
and can walk PR → PO → GR on the SAP MM demo mirror. If asked whether this is
live production SAP, the assistant should say it is an **Oxmaint AI projection
mirrored to SAP shapes**, not a live ECC or S/4 connector. Branding is Oxmaint
AI (never Oxment).

## SAP-shaped MM + PM sync (demo facade)

Not a live SAP connector. The voice register seeds:

- **Reservations / component lines** on this week’s Assigned, In Progress, and
  Parts Hold jobs (plant `CVG1`, storage location, SAP material, on-hand).
- A **solid minority of Parts Hold** jobs carry an open PR and/or PO (not
  every hold needs the full chain). Store posts GR in session; that updates
  stock and releases the hold.
- **Functional location tree + equipment** on every sample asset
  (Superhub → GSE Operations → yard/shop → type → `CVG-PWR-0035`).
- Sync fields: `last_synced_at`, `source = SAP MM/PM demo mirror`,
  `pending_outbound_changes`, `apply_inbound_sap_change` for a synthetic IDoc.

Lifecycle when the chain is present: Asset (SAP PM) → Notification/MR → WO →
Reservation → PR → PO → GR → WO complete.

## Waterfall glossary (existing shop statuses)

The waterfall is a supervisor reading of statuses already on the register — not
a second status set. Synthetic Oxmaint AI projection.

| Stage | Shop status | Meaning |
|---|---|---|
| Planning originated | Assigned (no start locked) | Raised from the PM plan or an unplanned notification |
| Parts ready | Assigned, kit complete | All components reserved; waiting on a crew slot |
| Parts short | Parts Hold | Short / on-order → PR → PO → GR |
| Manpower planned | Assigned + planned start | Assignee and start/finish on the week board |
| In flow | In Progress | On the floor; some P4 Deferred; some scope variation |
| Technical review | QA Review | Waiting on supervisor close |
| Completed / archived | Closed | Done; archived has a flag and date |

MCP tools (same ones ChatGPT / Grok / Claude see on `/api/mcp`):
`get_waterfall_pipeline`, `list_waterfall_stage`, `get_manpower_plan`,
`assign_work_order`, `flag_scope_variation`, `advance_waterfall_stage`,
`close_technical_review`, `archive_work_order`. Store still owns PR/GR.

Without a phone, the same answers are:

```bash
NEXT_PUBLIC_OXMAINT_PACK=dhl-gse node scripts/verify-dhl-voice.mjs
curl -s https://<host>/api/mcp
# POST /api/mcp  { "jsonrpc":"2.0","id":1,"method":"tools/call",
#   "params": { "name":"get_waterfall_pipeline","arguments": { "period": "week" } } }
```

## Routes

| Path | Role |
|---|---|
| `/portal/oxmaint/gse-voice` | Call card |
| `/api/voice/config` | Public number + realtime flag |
| `/api/voice/xai/incoming` | xAI SIP webhook |
| `/api/voice/twilio/incoming` | Twilio TwiML → media stream |
| `/api/voice/media-stream` | Twilio ↔ xAI μ-law bridge |
| `/api/mcp` | MCP tools used on the call |
| `/portal/oxmaint/gse-waterfall` | Supervisor waterfall / pipeline |
| `/portal/oxmaint/gse-workmanship` | Five-year bands plus current-period scores |
| `/portal/oxmaint/gse-spare-insights` | OEM vs aftermarket variant card |
| `/portal/oxmaint/gse-audit-report` | Airline audit PDF download |
| `/api/oxmaint/audit-report?period=quarter\|6m` | JSON summary |
| `/api/oxmaint/audit-report.pdf?period=quarter\|6m` | Dated PDF (Oxmaint AI branding, TOC, page numbers) |

Sample PDF (no phone needed):

```bash
NEXT_PUBLIC_OXMAINT_PACK=dhl-gse node scripts/verify-dhl-voice.mjs
# writes artifacts/dhl-gse-airline-audit-quarter.pdf
curl -sS "http://localhost:3000/api/oxmaint/audit-report.pdf?period=quarter" -o /tmp/audit.pdf
```

The PDF footer and this page say the same thing: synthetic Oxmaint AI projection
mirrored to SAP shapes — not live airline or production SAP data.
