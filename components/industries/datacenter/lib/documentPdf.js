// The estate's documents, rendered as documents you can actually open.
//
// The library lists O&M manuals, drawings, commissioning reports, calibration
// certificates and spare-parts lists against every asset — but a row is only a
// row until you can open it. This draws each one as the document it claims to
// be, from the asset it is tied to: a manual gets specifications, a PM schedule
// and a troubleshooting table for its equipment class; a drawing gets a title
// block and a class-appropriate schematic; a certificate gets as-found/as-left
// readings and a traceability statement. The content is generated from the
// asset's own class and manufacturer, so it reads as this estate's paperwork
// rather than a generic sample.
//
// jsPDF (and SheetJS for the spares workbook) is imported dynamically so neither
// lands in the bundle of the screens that never export anything.

const A4 = { w: 595.28, h: 841.89 }
const LAND = { w: 841.89, h: 595.28 }
const M = 48
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]
const SOFT = [241, 245, 249]

const clean = (v) => String(v ?? '-')
  .replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/·/g, '-').replace(/…/g, '...').replace(/[^\x20-\xFF]/g, '')

// Deterministic identity so the same document always carries the same model,
// serial, document number and revision — no clock, no random.
const hash = (s) => { let h = 2166136261; const t = String(s || ''); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }
const pick = (arr, seed) => arr[seed % arr.length]

const shortId = (doc) => String(doc.asset_id || doc.document_id || 'AST').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()
const modelNo = (doc, asset) => `${String(asset?.manufacturer || doc.manufacturer || 'OEM').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OEM'}-${2000 + hash(doc.asset_id) % 7000}`
const serialNo = (doc) => `SN-${100000 + hash(doc.document_id) % 899999}`
const rev = (doc) => pick(['A', 'B', 'C', 'D'], hash(doc.document_id + 'r'))
const docNo = (doc) => {
  const p = { Manual: 'OM', Drawing: 'DWG', Report: 'CR', Certificate: 'CAL', Spares: 'SP' }[doc.category] || 'DOC'
  return `${p}-${shortId(doc)}-${String(1 + hash(doc.document_id) % 9).padStart(2, '0')}`
}

// ── equipment class profiles ────────────────────────────────────────────────
// The specifications, PM schedule, troubleshooting and spares that make a manual
// read as the manual for THIS kind of plant. Keyed off the asset class wording.
function classProfile(cls = '', manufacturer = '') {
  const c = String(cls).toLowerCase()
  const is = (...k) => k.some((x) => c.includes(x))
  const spread = (n) => (hash(cls + n) % 100)

  if (is('chiller', 'crah', 'crac', 'condenser', 'cooling', 'ahu', 'air handl', 'pump', 'fan', 'coil', 'cdu', 'heat')) {
    return {
      discipline: 'Mechanical / Cooling',
      specs: [
        ['Cooling capacity', `${350 + spread('cap') * 5} kW (${Math.round((350 + spread('cap') * 5) / 3.517)} TR)`],
        ['Chilled-water flow', `${18 + spread('flow') % 30} L/s`],
        ['Supply / return temp', '7 °C / 12 °C (ΔT 5 K)'],
        ['Refrigerant', pick(['R-134a', 'R-513A', 'R-1234ze'], spread('ref'))],
        ['Electrical supply', '400 V, 3-phase, 50 Hz'],
        ['Full-load current', `${120 + spread('fla') % 180} A`],
        ['Sound power level', `${78 + spread('snd') % 8} dB(A)`],
      ],
      pm: [
        ['Inspect and clean air filters', 'Monthly', 'MP-01'],
        ['Coil condition and fin comb', 'Quarterly', 'MP-02'],
        ['Belt tension / drive alignment', 'Quarterly', 'MP-03'],
        ['Vibration analysis on rotating assy', 'Quarterly', 'MP-04'],
        ['Refrigerant charge and leak test', 'Semi-annual', 'MP-05'],
        ['Condenser water treatment check', 'Monthly', 'MP-06'],
        ['Full performance / capacity test', 'Annual', 'MP-07'],
      ],
      troubleshoot: [
        ['High discharge temperature', 'Fouled condenser / low flow', 'Clean condenser; verify pump and valve position'],
        ['Excess vibration', 'Bearing wear / imbalance', 'Trend vibration; rebalance or replace bearing'],
        ['Low cooling capacity', 'Low refrigerant / dirty coil', 'Leak-test and recharge; clean coil'],
        ['Nuisance high-pressure trip', 'Condenser airflow restriction', 'Clear obstruction; check fan operation'],
      ],
      spares: [
        ['Air filter, pleated', 'FLT-PL-24', 6],
        ['Drive belt', 'BLT-A48', 2],
        ['Bearing, motor DE', 'BRG-6209', 2],
        ['Contactor, 3-pole', 'CON-3P-40', 1],
        ['Refrigerant sensor', 'SEN-RF-01', 1],
      ],
      safety: ['Isolate and lock out electrical supply before service (LOTO).', 'Recover refrigerant to an approved cylinder; do not vent.', 'Guard rotating parts; confirm zero energy before removing covers.'],
    }
  }
  if (is('ups', 'battery', 'rectifier', 'inverter')) {
    return {
      discipline: 'Electrical / DC power & storage',
      specs: [
        ['Rated power', `${200 + spread('kva') % 600} kVA / ${Math.round((200 + spread('kva') % 600) * 0.9)} kW`],
        ['Topology', 'Double-conversion, online'],
        ['Input / output voltage', '400 V 3ph / 400 V 3ph'],
        ['Battery type', pick(['VRLA', 'Li-ion NMC', 'Li-ion LFP'], spread('bat'))],
        ['Autonomy at full load', `${6 + spread('rt') % 10} min`],
        ['Efficiency (eco / online)', '99% / 96.5%'],
        ['Nominal DC bus', `${384 + spread('dc') % 96} V`],
      ],
      pm: [
        ['Battery impedance / capacity test', 'Semi-annual', 'EP-11'],
        ['Capacitor inspection (DC / AC)', 'Annual', 'EP-12'],
        ['Cooling fan condition and hours', 'Quarterly', 'EP-13'],
        ['Thermographic scan of connections', 'Semi-annual', 'EP-14'],
        ['Firmware and event-log review', 'Quarterly', 'EP-15'],
        ['Full load / transfer test', 'Annual', 'EP-16'],
      ],
      troubleshoot: [
        ['On battery with mains healthy', 'Rectifier fault / input breaker', 'Check input supply and rectifier alarms'],
        ['Reduced autonomy', 'Aged / weak battery string', 'Impedance test; replace flagged cells'],
        ['High module temperature', 'Blocked airflow / fan failure', 'Clear filters; replace cooling fan'],
        ['Nuisance bypass transfer', 'Overload / sync loss', 'Verify load profile and bypass source'],
      ],
      spares: [
        ['Battery block', 'BAT-12V-100', 8],
        ['Cooling fan assembly', 'FAN-UPS-01', 2],
        ['DC bus capacitor', 'CAP-DC-450', 4],
        ['Control fuse set', 'FUS-CTL-SET', 1],
        ['Air filter mat', 'FLT-UPS-01', 4],
      ],
      safety: ['Hazardous DC voltage present even when isolated from mains — follow the battery isolation procedure.', 'Risk of arc flash; wear rated PPE and use insulated tools.', 'Observe battery-room ventilation and spill-kit requirements.'],
    }
  }
  if (is('pdu', 'switchgear', 'transformer', 'panel', 'busway', 'distribution', 'breaker', 'rpp', 'sts')) {
    return {
      discipline: 'Electrical / Power distribution',
      specs: [
        ['Rated voltage', pick(['400 V', '415 V', '11 kV / 400 V'], spread('v'))],
        ['Rated current', `${400 + spread('a') % 2600} A`],
        ['Rated capacity', `${250 + spread('kva') % 1750} kVA`],
        ['Phases / frequency', '3-phase, 50 Hz'],
        ['Short-circuit rating', `${25 + spread('sc') % 25} kA`],
        ['Ingress protection', pick(['IP31', 'IP42', 'IP54'], spread('ip'))],
        ['Metering', 'Class 0.5S, revenue-grade'],
      ],
      pm: [
        ['Thermographic survey (loaded)', 'Semi-annual', 'EP-01'],
        ['Torque-check terminations', 'Annual', 'EP-02'],
        ['Breaker contact resistance', 'Annual', 'EP-03'],
        ['Protection relay verification', 'Annual', 'EP-04'],
        ['Busbar / insulation inspection', 'Annual', 'EP-05'],
        ['Metering accuracy check', 'Annual', 'EP-06'],
      ],
      troubleshoot: [
        ['Hot-spot at termination', 'Loose / oxidised lug', 'De-energize per MOP; re-torque or replace lug'],
        ['Nuisance breaker trip', 'Protection setting / overload', 'Review trip log and load; verify settings'],
        ['Phase imbalance alarm', 'Uneven load distribution', 'Rebalance circuits across phases'],
        ['Metering drift', 'CT / calibration error', 'Verify CT ratio; recalibrate meter'],
      ],
      spares: [
        ['Moulded-case breaker', 'MCCB-250', 2],
        ['Control fuse set', 'FUS-CTL-SET', 1],
        ['Indication lamp (LED)', 'LMP-LED-24', 6],
        ['Auxiliary contact block', 'AUX-CB-01', 2],
        ['Panel cooling fan', 'FAN-PNL-01', 2],
      ],
      safety: ['Arc-flash hazard — establish an electrically safe work condition and wear rated PPE.', 'Apply lockout/tagout and prove dead before work.', 'Maintain approach boundaries; a second competent person is required for live work.'],
    }
  }
  if (is('generator', 'genset', 'gen ', 'engine')) {
    return {
      discipline: 'Electrical / Standby power',
      specs: [
        ['Prime power rating', `${750 + spread('kw') % 1750} kW / ${Math.round((750 + spread('kw') % 1750) * 1.25)} kVA`],
        ['Engine', `${pick(['12', '16', '20'], spread('cyl'))}-cylinder diesel`],
        ['Output voltage', '400 V, 3-phase, 50 Hz'],
        ['Fuel tank (bulk)', `${8000 + spread('fuel') % 12000} L`],
        ['Start system', '24 V DC electric'],
        ['Governing', 'Electronic isochronous'],
        ['Emissions', pick(['Stage V', 'Tier 4 Final'], spread('em'))],
      ],
      pm: [
        ['Oil and filter change', 'Semi-annual / 250 h', 'GP-01'],
        ['Coolant condition and level', 'Quarterly', 'GP-02'],
        ['Fuel polishing and water test', 'Quarterly', 'GP-03'],
        ['Battery and charger check', 'Quarterly', 'GP-04'],
        ['On-load bank test', 'Annual', 'GP-05'],
        ['Automatic start / transfer test', 'Monthly', 'GP-06'],
      ],
      troubleshoot: [
        ['Fails to start on demand', 'Battery / fuel / control', 'Check crank battery, fuel level and controller faults'],
        ['Runs then shuts down', 'High temp / low oil pressure', 'Inspect coolant and oil; clear alarm cause'],
        ['Voltage / frequency unstable', 'AVR / governor fault', 'Verify AVR and governor settings'],
        ['Fuel contamination', 'Water / microbial growth', 'Polish fuel; dose biocide; drain water trap'],
      ],
      spares: [
        ['Oil filter', 'FLT-OIL-01', 4],
        ['Fuel filter / separator', 'FLT-FUEL-01', 4],
        ['Coolant (premix), 20 L', 'CLT-20L', 2],
        ['Crank battery', 'BAT-24V-CR', 2],
        ['Drive belt set', 'BLT-GEN-SET', 1],
      ],
      safety: ['Diesel and exhaust hazard — ensure ventilation and hot-surface guarding.', 'Disable auto-start and lock out before mechanical work.', 'Fuel is flammable; observe bunding and spill controls.'],
    }
  }
  if (is('bms', 'epms', 'dcim', 'control', 'plc', 'node', 'sensor', 'gateway', 'network')) {
    return {
      discipline: 'Controls / Monitoring',
      specs: [
        ['Controller type', pick(['DDC controller', 'PLC', 'Edge gateway'], spread('t'))],
        ['I/O points', `${64 + spread('io') % 448}`],
        ['Protocols', 'BACnet/IP, Modbus TCP, SNMP'],
        ['Power supply', '24 V DC, redundant'],
        ['Redundancy', 'Hot-standby pair'],
        ['Historian sample rate', '1 s - 5 min configurable'],
        ['Cyber baseline', 'Hardened per site policy'],
      ],
      pm: [
        ['Configuration and database backup', 'Monthly', 'CP-01'],
        ['Firmware / patch review', 'Quarterly', 'CP-02'],
        ['Point-to-point calibration audit', 'Semi-annual', 'CP-03'],
        ['UPS / power-supply health', 'Quarterly', 'CP-04'],
        ['Alarm and trend integrity check', 'Quarterly', 'CP-05'],
      ],
      troubleshoot: [
        ['Point reads out of range', 'Sensor / wiring fault', 'Verify sensor and field wiring; recalibrate'],
        ['Comms loss to device', 'Network / address conflict', 'Check switch, cabling and device address'],
        ['Stale trend data', 'Historian / service stopped', 'Restart service; verify disk and time sync'],
        ['Nuisance alarms', 'Deadband / limit misconfig', 'Tune deadbands and alarm limits'],
      ],
      spares: [
        ['I/O module', 'IO-16DI', 2],
        ['24 V DC power supply', 'PSU-24-10', 2],
        ['Managed switch', 'SW-8P-IND', 1],
        ['Temperature sensor', 'SEN-T-01', 4],
        ['Patch lead set', 'NET-PATCH-SET', 1],
      ],
      safety: ['Follow change-control before editing live control logic.', 'Observe ESD precautions when handling modules.', 'Coordinate any output override with operations.'],
    }
  }
  return {
    discipline: 'General plant',
    specs: [
      ['Equipment class', cls || 'General'],
      ['Electrical supply', '400 V, 3-phase, 50 Hz'],
      ['Ingress protection', 'IP42'],
      ['Duty', 'Continuous'],
      ['Manufacturer', manufacturer || '-'],
    ],
    pm: [
      ['General visual inspection', 'Monthly', 'GN-01'],
      ['Fixings and connection check', 'Quarterly', 'GN-02'],
      ['Functional test', 'Semi-annual', 'GN-03'],
      ['Full service', 'Annual', 'GN-04'],
    ],
    troubleshoot: [
      ['Unit will not run', 'Supply / control fault', 'Verify supply and control circuit'],
      ['Abnormal noise', 'Mechanical wear', 'Inspect and replace worn parts'],
      ['Alarm active', 'Sensor / threshold', 'Investigate alarm source and reset'],
    ],
    spares: [
      ['Fuse set', 'FUS-SET', 1],
      ['Indication lamp', 'LMP-01', 4],
      ['Filter element', 'FLT-01', 2],
    ],
    safety: ['Isolate and lock out before service.', 'Wear appropriate PPE.', 'Confirm zero energy before removing covers.'],
  }
}

// ── shared drawing surface ──────────────────────────────────────────────────
function band(doc, { width, right, rightLabel, title }) {
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, width, 74, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255)
  doc.text('Oxmaint AI', M, 32)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(210, 218, 245)
  doc.text(clean(title || 'Document Library'), M, 48)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(255, 255, 255)
  doc.text(clean(right), width - M, 32, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(210, 218, 245)
  doc.text(clean(rightLabel), width - M, 48, { align: 'right' })
}

function openInTab(doc, name) {
  try {
    const url = doc.output('bloburl')
    const win = window.open(url, '_blank')
    if (!win) doc.save(name) // popup blocked — fall back to download
  } catch {
    doc.save(name)
  }
  return name
}

// ── the PDF documents ───────────────────────────────────────────────────────
async function renderPaper(doc2, spec, meta) {
  const doc = doc2
  let y = M
  const room = (need) => { if (y + need > A4.h - M - 26) { footer(); doc.addPage(); y = M } }
  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTE)
    doc.text(clean(`${meta.docNo} - Rev ${meta.rev}`), M, A4.h - 26)
    doc.text(`Page ${doc.getNumberOfPages()}`, A4.w - M, A4.h - 26, { align: 'right' })
    doc.text('Generated by Oxmaint AI - representative document', M, A4.h - 16)
  }
  const heading = (label) => {
    room(34); y += 8
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...MUTE)
    doc.text(clean(label).toUpperCase(), M, y); y += 6
    doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, y, A4.w - M, y); y += 14
  }
  const para = (s, opts = {}) => {
    const size = opts.size || 10
    doc.setFont('helvetica', opts.style || 'normal'); doc.setFontSize(size); doc.setTextColor(...(opts.color || INK))
    const lines = doc.splitTextToSize(clean(s), A4.w - M * 2)
    room(lines.length * (size + 3))
    lines.forEach((ln) => { doc.text(ln, M, y); y += size + 3 })
    y += 3
  }
  const bullets = (arr) => {
    arr.forEach((s) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
      const lines = doc.splitTextToSize(clean(s), A4.w - M * 2 - 14)
      room(lines.length * 13)
      doc.setTextColor(...ACCENT); doc.text('-', M, y); doc.setTextColor(...INK)
      lines.forEach((ln, i) => doc.text(ln, M + 14, y + i * 13)); y += lines.length * 13 + 2
    })
  }
  const kv = (rows) => {
    rows.forEach(([k, v]) => {
      const lines = doc.splitTextToSize(clean(v), A4.w - M - 190)
      room(Math.max(14, lines.length * 13) + 4)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...SUB)
      doc.text(clean(k).toUpperCase(), M, y + 9)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
      lines.forEach((ln, i) => doc.text(ln, M + 150, y + 9 + i * 13))
      y += Math.max(16, lines.length * 13 + 4)
    })
  }
  const table = (cols, rows) => {
    const tableW = A4.w - M * 2
    const widths = cols.map((c) => (c.w || 1))
    const wsum = widths.reduce((a, b) => a + b, 0)
    const px = widths.map((w) => (w / wsum) * tableW)
    const drawHead = () => {
      room(22)
      doc.setFillColor(...SOFT); doc.rect(M, y, tableW, 20, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SUB)
      let cx = M
      cols.forEach((c, i) => { doc.text(clean(c.h).toUpperCase(), cx + 6, y + 13); cx += px[i] })
      y += 20
    }
    drawHead()
    doc.setFontSize(9)
    rows.forEach((r, ri) => {
      const cells = r.map((cell, i) => doc.splitTextToSize(clean(cell), px[i] - 12))
      const rowH = Math.max(18, Math.max(...cells.map((c) => c.length)) * 11 + 8)
      if (y + rowH > A4.h - M - 30) { footer(); doc.addPage(); y = M; drawHead(); doc.setFontSize(9) }
      if (ri % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(M, y, tableW, rowH, 'F') }
      let cx = M
      cells.forEach((c, i) => {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setTextColor(...(i === 0 ? INK : SUB))
        c.forEach((ln, li) => doc.text(ln, cx + 6, y + 12 + li * 11)); cx += px[i]
      })
      doc.setDrawColor(...LINE); doc.setLineWidth(0.4); doc.line(M, y + rowH, M + tableW, y + rowH)
      y += rowH
    })
    y += 4
  }

  // cover band + title
  band(doc, { width: A4.w, right: meta.docNo, rightLabel: `Rev ${meta.rev}`, title: spec.kicker })
  y = 108
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ACCENT)
  doc.text(clean(spec.kicker).toUpperCase(), M, y); y += 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...INK)
  doc.splitTextToSize(clean(spec.title), A4.w - M * 2).forEach((ln) => { doc.text(ln, M, y); y += 21 })
  y += 2
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...SUB)
  doc.text(clean(spec.subtitle), M, y); y += 18
  doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, y, A4.w - M, y); y += 6

  heading('Document control')
  kv(meta.control)

  spec.sections.forEach((s) => {
    heading(s.heading)
    if (s.paras) s.paras.forEach((p) => para(p))
    if (s.bullets) bullets(s.bullets)
    if (s.kv) kv(s.kv)
    if (s.table) table(s.table.cols, s.table.rows)
  })

  if (spec.revisions) {
    heading('Revision history')
    table([{ h: 'Rev', w: 0.5 }, { h: 'Date', w: 1 }, { h: 'Description', w: 3 }, { h: 'By', w: 1 }], spec.revisions)
  }

  footer()
}

function manualSpec(doc, asset, prof) {
  return {
    kicker: 'Operation & Maintenance Manual',
    title: doc.document_name.replace(/ - O&M Manual$/i, ''),
    subtitle: `${prof.discipline} - ${asset?._site || doc.site_id || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: '1. Introduction & scope', paras: [
        `This manual covers the safe operation and maintenance of the ${asset?.assetName || doc.asset_name}, a ${asset?.assetClass || 'unit'} supplied by ${asset?.manufacturer || doc.manufacturer}. It applies to the unit installed at ${asset?._location || 'the site'}, ${asset?._site || ''}.`,
        'It is intended for competent technicians working under the site permit-to-work system. Read it in full before carrying out any operation or maintenance activity.',
      ] },
      { heading: '2. Safety', bullets: prof.safety },
      { heading: '3. Technical specifications', table: { cols: [{ h: 'Parameter', w: 1.4 }, { h: 'Value', w: 2 }], rows: [['Manufacturer', asset?.manufacturer || doc.manufacturer], ['Model', modelNo(doc, asset)], ['Serial number', serialNo(doc)], ['Asset tag', asset?.assetId || doc.asset_id], ['Criticality', `${asset?.criticality || '-'}${asset?._tier ? ` (${asset._tier})` : ''}`], ...prof.specs] } },
      { heading: '4. Operating instructions', paras: [
        'Start-up: confirm isolations are removed and permits closed, verify auxiliary supplies, then start via the local HMI and observe the unit reach steady state before placing it in AUTO.',
        'Normal operation: the unit runs under the building management system. Confirm set-points, review active alarms and trend the key parameters against the values in section 3.',
        'Shutdown: place in the manual/OFF state at the HMI, allow the run-down sequence to complete, then apply isolation and lockout before any intervention.',
      ] },
      { heading: '5. Preventive maintenance schedule', table: { cols: [{ h: 'Task', w: 2.6 }, { h: 'Frequency', w: 1.1 }, { h: 'Procedure', w: 0.8 }], rows: prof.pm } },
      { heading: '6. Troubleshooting', table: { cols: [{ h: 'Symptom', w: 1.5 }, { h: 'Probable cause', w: 1.4 }, { h: 'Corrective action', w: 2.1 }], rows: prof.troubleshoot } },
      { heading: '7. Recommended spare parts', table: { cols: [{ h: 'Part', w: 2 }, { h: 'Part number', w: 1.2 }, { h: 'Qty', w: 0.5 }], rows: prof.spares.map((s) => [s[0], s[1], String(s[2])]) } },
      { heading: '8. Warranty & support', paras: [`Warranty and field support are provided by ${asset?.manufacturer || doc.manufacturer} through the site's OEM service agreement. Quote the model and serial above when raising a support case.`] },
    ],
    revisions: [
      ['A', shift(doc, 400), 'First issue at commissioning', 'OEM'],
      ['B', shift(doc, 200), 'Updated PM intervals per site policy', 'Reliability'],
      [rev(doc), doc.created_date, 'Reviewed and re-issued', doc.uploaded_by_name],
    ],
  }
}

function reportSpec(doc, asset, prof) {
  const seed = hash(doc.document_id)
  const pf = (i) => (((seed >> i) & 7) === 0 ? 'Observation' : 'Pass')
  return {
    kicker: 'Commissioning Report',
    title: doc.document_name.replace(/ - Commissioning Report$/i, ''),
    subtitle: `${prof.discipline} - ${asset?._site || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: '1. Scope & references', paras: [
        `This report records the commissioning of the ${asset?.assetName || doc.asset_name} (${asset?.manufacturer || doc.manufacturer}, model ${modelNo(doc, asset)}) at ${asset?._location || 'the site'}, ${asset?._site || ''}.`,
        'Testing followed the approved method statement, the manufacturer commissioning schedule and the project Cx plan (levels 1-4: factory, installation, functional and integrated systems test).',
      ] },
      { heading: '2. Pre-commissioning checks', table: { cols: [{ h: 'Check', w: 3 }, { h: 'Result', w: 1 }], rows: [
        ['Installation and mounting to drawing', pf(1)], ['Electrical terminations torqued and IR-tested', pf(2)],
        ['Isolations, labelling and earthing verified', pf(3)], ['Auxiliary and control supplies confirmed', pf(4)],
      ] } },
      { heading: '3. Functional test results', table: { cols: [{ h: 'Test', w: 1.8 }, { h: 'Acceptance', w: 1.4 }, { h: 'Measured', w: 1.2 }, { h: 'Result', w: 0.8 }], rows: prof.specs.slice(0, 5).map((s, i) => [s[0], s[1], measured(s[1], seed + i), pf(i + 5)]) } },
      { heading: '4. Integrated systems test', paras: [
        'The unit was tested under BMS control including alarm annunciation, failure/redundancy response and return-to-normal. Sequences operated as designed and results were witnessed by the client representative.',
      ] },
      { heading: '5. Outstanding items (punch list)', bullets: (seed % 3 === 0)
        ? ['No outstanding items - all defects cleared at witnessing.']
        : ['Minor: update as-built label to match final tag.', 'Minor: trend two set-points over the first month of operation.'] },
      { heading: '6. Sign-off', kv: [['Commissioning engineer', pick(['A. Ribeiro', 'T. Whitfield', 'K. Watanabe'], seed)], ['Client witness', doc.uploaded_by_name], ['Date completed', doc.created_date], ['Status', 'Accepted']] },
    ],
    revisions: [['0', shift(doc, 40), 'Draft for review', 'Cx'], ['1', doc.created_date, 'Final issued and accepted', doc.uploaded_by_name]],
  }
}

function certSpec(doc, asset, prof) {
  const seed = hash(doc.document_id)
  const rows = ['0%', '25%', '50%', '75%', '100%'].map((pt, i) => {
    const nominal = (i * 25)
    const err = (((seed >> (i + 1)) % 7) - 3) / 10
    return [pt, `${nominal.toFixed(1)}`, `${(nominal + err).toFixed(2)}`, `${err.toFixed(2)}`, '±0.5', 'Pass']
  })
  return {
    kicker: 'Calibration Certificate',
    title: doc.document_name.replace(/ - Calibration Certificate$/i, ''),
    subtitle: `Traceable calibration - ${asset?._site || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: 'Instrument under test', kv: [
        ['Description', `${asset?.assetName || doc.asset_name} instrumentation`], ['Manufacturer', asset?.manufacturer || doc.manufacturer],
        ['Model', modelNo(doc, asset)], ['Serial number', serialNo(doc)], ['Asset tag', asset?.assetId || doc.asset_id], ['Location', asset?._location || asset?._site || '-'],
      ] },
      { heading: 'Calibration details', kv: [
        ['Certificate number', docNo(doc)], ['Standard / method', 'ISO/IEC 17025; manufacturer procedure'],
        ['Reference standard', `Fluke ref. STD-${1000 + seed % 8999} (traceable to national standards)`],
        ['Ambient conditions', `${21 + seed % 3} °C, ${45 + seed % 15}% RH`],
        ['Date of calibration', doc.created_date], ['Calibration due', shift(doc, -365)],
      ] },
      { heading: 'As-found / as-left readings', table: { cols: [{ h: 'Point', w: 0.8 }, { h: 'Nominal', w: 1 }, { h: 'Measured', w: 1 }, { h: 'Error', w: 0.8 }, { h: 'Tol.', w: 0.7 }, { h: 'Result', w: 0.8 }], rows } },
      { heading: 'Statement of traceability', paras: [
        'The measurements above are traceable to national metrology standards through the reference equipment listed. The reported expanded uncertainty is stated at a coverage factor k=2, approximately 95% confidence.',
        'The instrument was found within tolerance (as-found) and requires no adjustment (as-left).',
      ] },
      { heading: 'Authorisation', kv: [['Calibrated by', pick(['M. Hale', 'P. Nair', 'D. Osei'], seed)], ['Approved by', doc.uploaded_by_name], ['Accreditation', 'Site calibration laboratory']] },
    ],
  }
}

function shift(doc, days) {
  const base = new Date(`${doc.created_date}T00:00:00`)
  if (Number.isNaN(base.getTime())) return doc.created_date
  return new Date(base.getTime() - days * 86400e3).toISOString().slice(0, 10)
}
function measured(spec, seed) {
  const m = String(spec).match(/([\d.]+)/)
  if (!m) return spec
  const n = parseFloat(m[1])
  const v = (n * (0.98 + (seed % 4) / 100)).toFixed(n >= 100 ? 0 : 1)
  return String(spec).replace(m[1], v)
}

// ── the drawing (landscape, title block + schematic) ────────────────────────
function renderDrawing(doc, meta, asset, prof) {
  const W = LAND.w; const H = LAND.h
  band(doc, { width: W, right: meta.docNo, rightLabel: `Rev ${meta.rev}`, title: 'Engineering Drawing' })

  // border
  doc.setDrawColor(...INK); doc.setLineWidth(1); doc.rect(M / 2, 84, W - M, H - 84 - M / 2)

  // schematic area
  const ox = 90; const oy = 150
  const box = (x, yb, w, h, label, sub) => {
    doc.setDrawColor(...ACCENT); doc.setLineWidth(1.2); doc.setFillColor(255, 255, 255); doc.roundedRect(x, yb, w, h, 4, 4, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK)
    doc.text(clean(label), x + w / 2, yb + h / 2 - 1, { align: 'center' })
    if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...SUB); doc.text(clean(sub), x + w / 2, yb + h / 2 + 11, { align: 'center' }) }
  }
  const flow = (x1, y1, x2, y2) => { doc.setDrawColor(...SUB); doc.setLineWidth(1.4); doc.line(x1, y1, x2, y2); doc.setFillColor(...SUB); doc.triangle(x2, y2, x2 - 7, y2 - 4, x2 - 7, y2 + 4, 'F') }

  const cool = /chiller|crah|crac|cool|pump|condenser|coil|ahu|cdu|heat|fan/i.test(asset?.assetClass || '')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text(clean(cool ? 'Process / P&ID schematic' : 'Single-line power schematic'), ox, oy - 18)

  if (cool) {
    box(ox, oy, 120, 54, 'Chilled water', 'return 12 C')
    flow(ox + 120, oy + 27, ox + 175, oy + 27)
    box(ox + 175, oy - 6, 130, 66, asset?.assetName?.slice(0, 22) || 'Cooling unit', modelNo(meta, asset))
    flow(ox + 305, oy + 27, ox + 360, oy + 27)
    box(ox + 360, oy, 120, 54, 'Chilled water', 'supply 7 C')
    box(ox + 175, oy + 110, 130, 46, 'Condenser loop', 'to cooling tower')
    flow(ox + 240, oy + 60, ox + 240, oy + 110)
    box(ox + 520, oy, 150, 66, 'BMS / DDC', 'BACnet control')
    flow(ox + 520, oy + 33, ox + 305, oy + 20)
  } else {
    box(ox, oy, 120, 54, 'Utility / UPS', '400 V 3ph')
    flow(ox + 120, oy + 27, ox + 175, oy + 27)
    box(ox + 175, oy - 6, 120, 66, 'Main breaker', prof.specs.find((s) => /current|rated/i.test(s[0]))?.[1] || 'ACB')
    flow(ox + 295, oy + 27, ox + 350, oy + 27)
    box(ox + 350, oy - 6, 140, 66, asset?.assetName?.slice(0, 22) || 'Distribution', modelNo(meta, asset))
    flow(ox + 490, oy + 27, ox + 545, oy + 27)
    box(ox + 545, oy, 120, 54, 'IT / mechanical', 'load')
    box(ox + 350, oy + 110, 140, 46, 'Metering / EPMS', 'Class 0.5S')
    flow(ox + 420, oy + 60, ox + 420, oy + 110)
  }

  // notes
  let ny = oy + 200
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text('NOTES', ox, ny); ny += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK)
  const notes = [
    '1. This drawing is schematic and not to scale; refer to the asset register for tags.',
    '2. All work under the site permit-to-work and lockout/tagout procedures.',
    `3. Equipment: ${asset?.manufacturer || meta.manufacturer}, model ${modelNo(meta, asset)}, tag ${asset?.assetId || meta.asset_id}.`,
    '4. Ratings and set-points per the O&M manual, section 3.',
  ]
  notes.forEach((n) => { doc.text(clean(n), ox, ny); ny += 13 })

  // title block bottom-right
  const bw = 320; const bh = 96; const bx = W - M / 2 - bw; const by = H - M / 2 - bh
  doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.rect(bx, by, bw, bh)
  doc.line(bx, by + 54, bx + bw, by + 54); doc.line(bx + bw * 0.62, by, bx + bw * 0.62, by + bh)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text(clean(meta.title), bx + 8, by + 20, { maxWidth: bw * 0.6 - 12 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SUB)
  doc.text(clean(`${asset?._site || ''}  -  ${asset?._location || ''}`), bx + 8, by + 40, { maxWidth: bw * 0.6 - 12 })
  const tbRow = (label, value, ry) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTE); doc.text(clean(label).toUpperCase(), bx + 8, ry); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(clean(value), bx + 8, ry + 10) }
  tbRow('Drawn / checked', `${doc.uploaded_by_name || '-'}`, by + 66)
  tbRow('Date', meta.created_date, by + 84)
  const rx = bx + bw * 0.62 + 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTE)
  doc.text('DRAWING No.', rx, by + 14); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(clean(meta.docNo), rx, by + 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTE); doc.text('REV', rx, by + 42); doc.text('SCALE', rx + 50, by + 42); doc.text('SHEET', rx + 100, by + 42)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(clean(meta.rev), rx, by + 54); doc.text('NTS', rx + 50, by + 54); doc.text('1 of 1', rx + 100, by + 54)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTE); doc.text('Oxmaint AI - representative drawing', rx, by + 84)
}

// ── the spares workbook (real .xlsx) ────────────────────────────────────────
async function renderSpares(doc, asset, prof) {
  const XLSX = await import('xlsx')
  const header = ['Item', 'Part description', 'Part number', 'Manufacturer', 'Qty on hand', 'Min stock', 'Lead time (wks)', 'Unit cost']
  const rows = prof.spares.map((s, i) => {
    const seed = hash(doc.document_id + i)
    return [i + 1, s[0], s[1], asset?.manufacturer || doc.manufacturer, s[2], Math.max(1, Math.floor(s[2] / 2)), 2 + seed % 10, `${(40 + seed % 900)}`]
  })
  const ws = XLSX.utils.aoa_to_sheet([
    [`${doc.asset_name} - Recommended Spare Parts`],
    [`Asset ${asset?.assetId || doc.asset_id} - ${asset?.manufacturer || doc.manufacturer} - ${asset?._site || ''}`],
    [],
    header,
    ...rows,
  ])
  ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Spare parts')
  XLSX.writeFile(wb, `${clean(doc.document_id)}.xlsx`)
  return `${doc.document_id}.xlsx`
}

// ── entry point ─────────────────────────────────────────────────────────────
/**
 * Open one document from the library as the document it represents.
 * PDFs open in a new tab; the spares list downloads as a real .xlsx.
 */
export async function openDocument(document, asset) {
  const doc = document
  const prof = classProfile(asset?.assetClass || doc.asset_name, asset?.manufacturer || doc.manufacturer)
  const meta = {
    docNo: docNo(doc), rev: rev(doc), title: doc.document_name.replace(/ - .*$/, ''),
    manufacturer: asset?.manufacturer || doc.manufacturer, asset_id: doc.asset_id, created_date: doc.created_date,
    uploaded_by_name: doc.uploaded_by_name,
    control: [
      ['Document number', docNo(doc)], ['Revision', rev(doc)], ['Issue date', doc.created_date],
      ['Asset', `${asset?.assetName || doc.asset_name} (${asset?.assetId || doc.asset_id})`],
      ['Manufacturer', asset?.manufacturer || doc.manufacturer], ['Site', asset?._site || doc.site_id || '-'],
      ['Prepared by', doc.uploaded_by_name],
    ],
  }

  // Spare-parts list — a real workbook.
  if (doc.document_type === 'XLSX' || doc.category === 'Spares') {
    return renderSpares(doc, asset, prof)
  }

  const { jsPDF } = await import('jspdf')

  // Drawing — a landscape sheet with a title block and a schematic.
  if (doc.document_type === 'DWG' || doc.category === 'Drawing') {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
    renderDrawing(pdf, meta, asset, prof)
    return openInTab(pdf, `${doc.document_id}.pdf`)
  }

  // Everything else — a portrait paper document.
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const spec = doc.category === 'Report' ? reportSpec(doc, asset, prof)
    : doc.category === 'Certificate' ? certSpec(doc, asset, prof)
      : manualSpec(doc, asset, prof)
  await renderPaper(pdf, spec, meta)
  return openInTab(pdf, `${doc.document_id}.pdf`)
}
