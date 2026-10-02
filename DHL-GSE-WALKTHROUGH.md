# DHL Express CVG — GSE maintenance portal

How the portal works, and how to walk a DHL evaluator through it.

Open it at **/portal/oxmaint** with the DHL organisation loaded (build or run with
`NEXT_PUBLIC_OXMAINT_PACK=dhl-gse`). The footer's **Switch portal** changes organisation.

---

## 1. What is in it

The register is a five-year extract for CVG ground support equipment: **150 units**, 25 people on
Days / Swing / Nights, 74 stocked parts, 117 manuals, **2,769 historic work orders**, 170 purchase
orders, 112 warranty claims and 20 quarterly cycle counts. The last twelve months of the workbook
(631 jobs) stay as history; the **current week / month** on the Work Orders screen and the voice
line is a separate synthetic projection at Superhub throughput — about **1,600 jobs a month
(~400 a week)** — so a call about “how many this week” does not read as a quiet shop.

The data is synthetic but operationally patterned — built from published operating scale and
industry practice, not DHL's own records. Every screen says so where it matters, the RFP
Coverage screen says it in full, and the voice line says it if asked.

DHL's own words stay on the record. A job shows its priority as the shop writes it
("P1-AOG / Gate Hold", "Parts Hold", "A-Aircraft Contact") next to the portal's own status.

Dates move with the calendar: whenever the demo is given, the register reads as though it runs
up to today.

---

## 2. Who does what

| Role | Where they work | What they do |
|---|---|---|
| Ramp operator | My Tasks, Checklists | Daily pre-use walkaround; a failed check raises a job |
| GSE technician | My Tasks, Work Orders | Takes the job, logs hours, issues parts, closes it |
| Lead / supervisor | Work Orders, Approvals, Technician KPIs | Assigns, approves spend, watches come-backs and wrench time |
| Planner | PM Schedules, Meters & Utilisation | Keeps hour-based and calendar services due on time |
| Parts clerk | Parts, Stocks, Purchase Orders, Cycle Counts | Issues kits, reorders, counts bins |
| Warranty analyst | Warranty Recovery | Claims what the vendor owes, records the decision |
| Manager | Dashboard, Five-Year Performance, Reports | Cost, downtime, availability, audit position |

---

## 3. The day, end to end

**A unit is due a service.** *Meters & Utilisation* holds the hour meters. A reading is a record of
its own — who read it, when, from what source — because a warranty claim turns on what the meter
said on a date. When the hours pass the interval, the 250-hour service falls due on *PM Schedules*;
calendar services (30-day, annual DOT / IATA) fall due the same way, **whichever comes first**.

**A unit breaks on the ramp.** The job is raised on *Work Orders* against the unit, priority
P1-AOG if an aircraft is waiting. It carries the system (Brakes, GPU, Conveyor), the shift and the
meter reading at open.

**The technician works it.** On the job: status to In Progress, hours on the **Time** tab against
the shift the technician was scheduled that day — that is the wrench-time measure. Notes go on
**Comments**. If the unit is off the line, the **out-of-service** entry records whether ramp control
was told, which is the question an airline audit asks.

**Parts go on.** **Materials → Issue kit** offers the kit the job calls for — a 250-hour service
suggests the 250-hr diesel PM kit, a brakes job on a tractor suggests the brake kit — priced **OEM or
aftermarket**. Issuing takes every line out of stock and books it onto the job in one step, and
refuses the whole kit if any line is short, naming the short part.

**It closes.** Labour and parts give the job its cost. The **History** tab shows every change, who
made it and what it was before — the same trail the *Audit Trail* screen holds for the whole portal.

**A part failed too early.** The job's **Materials** tab shows it: same part, same unit, replaced
inside its warranty and its typical life. **Raise claim** opens *Warranty Recovery* on that case;
the analyst files it and later records the vendor's decision and the credit.

**The stores count.** *Cycle Counts* runs quarterly. A new count is entered against live stock,
each variance given a reason (Misbin, Receiving lag, Unposted issue, Damaged write-off, UOM error),
and approving it posts the adjustments to the stock ledger.

---

## 4. Demo path (about 15 minutes)

1. **Dashboard** — open work, overdue, PM compliance, assets down. The position, in one screen.
2. **GSE Fleet → Fleet Readiness** — what the ramp can field right now, and what is blocking it.
3. **GSE Fleet → Meters & Utilisation** — log a reading; show the service tier move with it.
4. **Work Orders** — open a closed 250-hour service. Walk the tabs: **Comments** (what the
   technician wrote), **Time** (hours against scheduled), **Materials** (parts, vendor, warranty),
   **Overview** (out of service, ramp control notified, airline audit pack), **History**.
5. **Materials → Issue kit** — issue a kit, OEM against aftermarket, and show the stock move.
6. **GSE Fleet → Warranty Recovery** — the unclaimed money, then raise one claim and approve it.
7. **GSE Fleet → Parts Kits & Sourcing** — kit cost OEM vs aftermarket; where the aftermarket part
   earns its place and where it does not.
8. **GSE Fleet → Cycle Counts** — accuracy by session, variance by reason.
9. **GSE Fleet → Technician KPIs** — wrench time against target, come-backs, rework.
10. **GSE Fleet → Five-Year Performance** — five years of cost, downtime, fleet and parts; open on
    **ramp control not notified on 211 of 843 out-of-service entries**.
11. **GSE Fleet → RFP Coverage** — requirement by requirement, marked yes / partial / roadmap.
12. **GSE Fleet → Voice demo** — call card for **+1 (415) 639-4335**. After the greeting say
    **0001** (technician Alex Rivera), **0002** (supervisor week plan), or **0003** (store /
    Parts Hold). Materials and the asset tree are an Oxmaint AI projection mirrored to
    **SAP MM (PR → PO → GR, stock sync)** and **SAP PM (functional location + equipment)**.
    Example questions: stock / on order, open PRs this week, PR status, where
    `CVG-PWR-0035` sits in the hierarchy, Alex Rivera’s workmanship score,
    which spare variants are best fit, “generate the last quarter audit report”,
    “how many this week are still in planning?”, “how many need a PR?”,
    “how many have scope variation?”, “what’s waiting on my technical close?”,
    “manpower plan for Thursday?”.
    Not a live production SAP connector. Setup and spoken scripts: `VOICE-SETUP.md`.
13. **GSE Fleet → Spare variant insights** — OEM vs aftermarket on the current
    register: best fit, higher value, stay-with-OEM, drives-holds.
14. **GSE Fleet → Airline audit PDF** — last quarter or last six months. Dated
    Oxmaint AI pack (TOC, page numbers). Synthetic — not live airline/SAP data.
    API: `GET /api/oxmaint/audit-report.pdf?period=quarter|6m`.
15. **GSE Fleet → WO waterfall** — supervisor pipeline on the existing statuses
    (planning → parts ready/short → manpower → in flow → review → archived).

On a phone, use the menu button top left: the sidebar opens as a drawer. A technician can open a
job, change its status and log time from there.

---

## 5. What is live, and what is history

- **Live.** Work orders, readings, labour, parts issues, kit issues, warranty claims, cycle counts,
  documents and the audit trail. Anything done in the portal is stored and survives a reload.
- **History.** Five-Year Performance and Technician KPIs read the five-year record, so they do not
  move when a job is closed during the demo. Say so rather than letting it be noticed.

---

## 6. Honest answers to likely questions

- **Is this live production SAP?** — no. Voice materials and the asset tree are an
  Oxmaint AI projection mirrored to SAP MM/PM shapes (sync facade + synthetic IDocs)
  so the demo works offline. Not a live ECC or S/4 connector.
- **Are workmanship scores and the airline audit PDF live airline data?** — no.
  They are a synthetic Oxmaint AI projection. The PDF footer says so.
- **Telematics feed instead of manual meter entry** — not built; readings are entered or imported.
- **Charge scheduling against flight banks** — not built.
- **Annual certification records** — partial: certificates are held and tracked, not issued.
- **Come-back links in this extract** — 73 of 75 point at a job raised *after* the come-back, so the
  portal shows those as related work orders rather than asserting a sequence the dates contradict.
- **Warranty candidates** — found from install history (same part, same unit, failed inside warranty
  and typical life, on an unscheduled job), not from the extract's repeat-install flag, which marks
  2,710 of 5,585 part lines.
- **Recovery rate reads 100%** — in this extract every approved claim was credited in full and every
  denied claim carries no amount.

---

## 7. Numbers worth knowing

| | |
|---|---|
| Work orders, 5 years (workbook) | 2,769 — 1,789 preventive, 980 unscheduled |
| Current month / week (voice projection) | ~1,600 / ~400 — synthetic Superhub throughput, not DHL actuals |
| Come-back rate | 7.7% against an internal standard of 10% |
| Out of service | 843 events; ramp control not notified on 211 (25%) |
| Downtime | 7,650 hours; work order cost $727,862 |
| Fleet | 150 units, $10,380,061 acquisition; a sample of 3,727 units at CVG |
| Wrench time | 67.8% last 12 months, 69.0% over 5 years, target 65% |
| Unclaimed warranty | $7,044 across 49 cases in 12 months; $37,165 across 230 in 5 years |
| Parts | $100,392 on hand; aftermarket is 7% of lines against a 28% plan |
| Cycle counts | 20 sessions, 360 lines, net variance −$19,872 |
