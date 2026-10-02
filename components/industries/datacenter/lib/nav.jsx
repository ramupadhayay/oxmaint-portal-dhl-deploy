// Navigation model for the Data Center FSM portal.
//
// Same shape as the Oxmaint portal's nav — groups with children, `single` for
// a one-screen group, keywords for search — so the sidebar and the pages read
// the same structure and neither portal's menu code has to learn a second one.
//
// The groups are the domains of the client's own module architecture, in its
// order: the command layer an operator opens first, the acquisition and sensing
// layer beneath it, asset health, the floor and compute, the analytics core,
// then the rounds, the work and the governance records. Naming them what that
// document names them means a reader who has the architecture in front of them
// can find any module in this menu without translating.
//
// Two departures, both deliberate. The domains it lists that this portal holds
// nothing for — grid and utility AI, smart building and energy, digital twin,
// the adjacent verticals — are not here at all: a menu entry that opens on
// nothing is worse than an absence, and its own summary puts them outside this
// programme. And Inspection stays exactly as it was, because the architecture
// has no domain to fold it into — the platform reads a CMMS, it does not run
// the rounds.

const s = (p) => (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>)

const ICONS = {
  overview: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  kpis: s(<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>),
  sites: s(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  assets: s(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>),
  power: s(<><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /><path d="M2 20h4M18 20h4" /></>),
  monitoring: s(<><path d="M3 12h4l2-6 4 12 2-6h6" /></>),
  alerts: s(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>),
  sources: s(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>),
  inspection: s(<><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>),
  maintenance: s(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
  governance: s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  reference: s(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>),
  members: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  documents: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8M16 17H8M10 9H8" /></>),
}

export function sectionIcon(key, color = '#64748b') {
  return ICONS[key] ? ICONS[key](color) : null
}

/**
 * The icon for a section, taken from the group it belongs to.
 *
 * Screens ask for this by their own section key rather than naming an icon, so
 * a screen moved to a different group picks up that group's icon instead of
 * keeping the old one and quietly disagreeing with the sidebar.
 */
export function iconForSection(key, color = '#15227a') {
  for (const g of MENU) {
    if (g.single && g.key === key) return sectionIcon(g.icon || g.key, color)
    if (g.children?.some((c) => c.key === key)) return sectionIcon(g.icon, color)
  }
  return null
}

export const MENU = [
  {
    // 3.1 Command & Insights Layer — "the layer executives and control-room
    // operators open first". Four of its six modules exist here; Real-Time KPIs
    // is this portal's KPI dashboard, and Operator Decision Queue is the
    // approve/defer list the recommendations screen already is.
    key: 'command-grp', label: 'Command & Insights', icon: 'overview',
    children: [
      { key: 'overview', label: 'Executive Overview', kw: 'overview dashboard summary programme status home scope progress executive roll-up fleet' },
      { key: 'kpis', label: 'Real-Time KPIs', kw: 'kpi technical operational sensor availability data acquisition reliability alert accuracy false positive target live metrics' },
      { key: 'alerts', label: 'Alerts & Notifications', kw: 'alert anomaly severity engineering review condition validated true false positive linked work order threshold notification' },
      { key: 'reports', label: 'Reports', kw: 'reports maintenance cost reliability compliance mttr mtbf unplanned planned completion rate type mix source of raise close loop rate pm adherence evidence pack accuracy proof 90 day trend' },
    ],
  },
  {
    // Analytics & AI Core, moved up to sit right under the command layer: this is
    // the portal's intelligence, and the AI Auditor closed loop belongs here with
    // the analytics that feed it, not in the command menu.
    key: 'analytics-grp', label: 'Analytics & AI Core', icon: 'kpis',
    children: [
      { key: 'recommendations', label: 'AI Auditor', kw: 'ai auditor risk engine closed loop recommendation maintenance action urgency work order dispatched technician finding outcome approve defer decision queue sla escalation orphan' },
      { key: 'trend', label: 'Trend Analysis', kw: 'trend analysis time series chart baseline threshold crossing early detection vibration thermal ultrasound lead time historical' },
      { key: 'detections', label: 'Failure Prediction', kw: 'detection alert failure code confidence cross sensor correlation corroborated severity pattern recognition prediction vib-brg thm-elec' },
      { key: 'correlation', label: 'Correlation Analytics', kw: 'correlation physical inspection finding confirmed anomaly failure mode lead time detection insight cross source' },
      { key: 'failure-codes', label: 'Standardized Failure Codes', kw: 'failure code vibration thermal ultrasound mode bearing wear misalignment imbalance arcing standardized' },
      { key: 'outcomes', label: 'Outcome Log', kw: 'outcome log accuracy false positive rate predicted actual finding true positive correlation proof go no-go' },
    ],
  },
  {
    // 3.3 and 3.4 are two domains over one set of readings, so the Health Center
    // sits above both rather than beside them. Mechanical is a domain of its own
    // here because the architecture calls it the biggest gap — and on this
    // estate it is seven of the thirteen monitored assets.
    key: 'health-grp', label: 'Asset Health', icon: 'monitoring',
    children: [
      { key: 'monitoring', label: 'Asset Health Center', kw: 'asset condition overview estate fleet live health score status last alert landing monitored population centre' },
      { key: 'power-health', label: 'Power Asset Health', kw: 'power electrical ups switchgear transformer pdu static switch generator arc flash dga battery health' },
      { key: 'ups-health', label: 'UPS Health Optimizer', kw: 'ups battery state of health reserve runtime cell module hot swap window blade replacement forecast' },
      { key: 'mechanical-health', label: 'Mechanical Asset Health', kw: 'mechanical crah crac chiller condenser cooling tower pump ahu dry cooler pdm vibration' },
      { key: 'assets', label: 'Asset Register', kw: 'asset register master final asset scope matrix criticality monitoring method included excluded manufacturer failure codes fasm' },
      { key: 'asset-classes', label: 'Asset Classes', kw: 'asset class mechanical electrical supporting crah crac chiller ups switchgear generator pump strategy' },
      { key: 'asset-qr', label: 'Assets QR', kw: 'qr code tag label print scan asset barcode sticker floor mobile phone' },
    ],
  },
  {
    // 3.5 Data Center Infrastructure (DCIM) & Compute. This rewrite skipped the
    // domain because the portal held nothing for it; it does now, so it is here
    // under the document's own name rather than beside it under ours.
    key: 'dcim-grp', label: 'DCIM & Compute', icon: 'power',
    children: [
      { key: 'dcim-floor', label: 'DCIM Floor', kw: 'dcim floor hall rack power draw design capacity pue inlet return air containment aisle' },
      { key: 'power-architecture', label: '800 VDC Architecture', kw: '800 vdc dc power architecture rectifier busbar rack pdu grid chip conversion efficiency nvidia' },
      { key: 'gpu-power', label: 'GPU Cluster Power', kw: 'gpu cluster compute power draw circuit headroom node utilisation cooling correlation' },
      { key: 'compute-telemetry', label: 'Compute Telemetry', kw: 'compute telemetry gpu server node pdu ssd nvme dcgm nvidia dell idrac redfish micron ecc xid throttle rul predictive rack fleet health score pue vendor per device' },
      { key: 'capacity-planner', label: 'Capacity Planner', kw: 'capacity planner headroom monte carlo cascade node growth what if simulation forward planning' },
    ],
  },
  {
    // Data Acquisition & Sensing — the data-source plumbing (BMS, EPMS, DCIM,
    // OEM, sensors), moved below the intelligence and infrastructure layers it
    // feeds rather than sitting second in the menu.
    key: 'sensing-grp', label: 'Integrations', icon: 'sources',
    children: [
      { key: 'systems', label: 'Asset Intelligence Connector', kw: 'systems bms epms dcim oem battery cmms protocol bacnet modbus snmp api data points scope integration connector hub' },
      { key: 'readings', label: 'Sensor Readings', kw: 'readings vibration thermal ultrasound measured value threshold baseline alarm warning normal condition monitoring' },
      { key: 'bms', label: 'BMS Integration', kw: 'bms building management supply return air temperature humidity valve damper airflow' },
      { key: 'epms', label: 'EPMS Integration', kw: 'epms electrical power monitoring bus voltage harmonic thd ground fault current breaker' },
      { key: 'dcim', label: 'DCIM Integration', kw: 'dcim pue power capacity headroom cooling capacity design energy' },
      { key: 'oem', label: 'OEM Monitoring', kw: 'oem platform vertiv life cummins powercommand mtu oncall health score remote diagnostic vendor native' },
      { key: 'battery', label: 'Battery Monitoring', kw: 'battery string cell voltage internal resistance state of health temperature vrla li-ion bms-b' },
    ],
  },
  {
    // Kept exactly as it was. It is the product's own Inspection module, ported
    // screen for screen, and the architecture has no equivalent domain to fold
    // it into — the platform reads a CMMS, it does not run the rounds.
    key: 'insp-grp', label: 'Inspection', icon: 'inspection',
    children: [
      { key: 'inspection-reports', label: 'Inspection Reports', kw: 'inspection report finding result pass fail observation score inspector technician round' },
      { key: 'inspection-reminder', label: 'Inspection Reminder', kw: 'inspection reminder due overdue schedule frequency next date assigned upcoming' },
      { key: 'incidents', label: 'Incident Reports', kw: 'incident history baseline root cause detection method downtime customer facing impact failure' },
      { key: 'checklists', label: 'Checklist', kw: 'checklist round items pass fail reading technician sheet template category mechanical electrical' },
    ],
  },
  {
    // Maintenance Scheduling is a Power Asset Health module in the architecture,
    // but the work it schedules spans both asset domains and the baseline PM is
    // its own commitment — so it stays a domain rather than a child of one.
    key: 'maint-grp', label: 'Maintenance', icon: 'maintenance',
    children: [
      { key: 'work-orders', label: 'Work Orders', kw: 'work order condition based calendar reactive trigger priority assigned outcome feedback analytics' },
      { key: 'pm-tasks', label: 'PM Task Library', kw: 'pm task library baseline calendar preventive frequency monthly quarterly annual ashrae nfpa standard' },
      { key: 'pm-calendar', label: 'PM Calendar', kw: 'pm calendar month schedule preventive maintenance planner due date recurring cadence plan visual' },
      { key: 'pm-compliance', label: 'PM Compliance', kw: 'pm compliance scheduled completed on time late team baseline preserved adherence variance checklist readings' },
    ],
  },
  {
    // The crews that carry the work, ported from the CMMS portal's Teams module
    // onto this estate's own data. A one-screen group, so it opens directly.
    key: 'teams', single: true, label: 'Teams', icon: 'members',
    kw: 'teams crew roster people technician engineer site engineering vendor oem lead load assigned members discipline',
  },
  {
    key: 'estate-grp', label: 'Sites & Locations', icon: 'sites',
    children: [
      { key: 'sites', label: 'Site Master', kw: 'sites campus building data hall region nam emea apac it load pue tier redundancy 2n n+1 zone' },
      { key: 'locations', label: 'Location Hierarchy', kw: 'location hierarchy building floor data hall room parent tree functional' },
    ],
  },
  {
    // Section 4 of the architecture, which asks for these to exist as tracked
    // records inside the platform rather than as one-off documents. Eight of its
    // nine are here; the monthly executive report is the one that is not.
    key: 'gov-grp', label: 'Governance', icon: 'governance',
    children: [
      { key: 'criticality', label: 'Asset Criticality Register', kw: 'criticality rating tier redundancy impact business impact response sla spof register' },
      { key: 'site-readiness', label: 'Site Readiness Checklist', kw: 'site readiness checklist prerequisites access permissions data sources owner status' },
      { key: 'tech-prereq', label: 'Technical Prerequisites', kw: 'technical prerequisites network vlan firewall cybersecurity power gateway firmware licensing' },
      { key: 'risks', label: 'Risk Register', kw: 'risk assumption dependency likelihood impact mitigation owner status register' },
      { key: 'stakeholders', label: 'Stakeholders & RACI', kw: 'stakeholder raci governance cadence responsible accountable review global regional site leadership' },
      { key: 'weekly-health', label: 'Stakeholder Reports', kw: 'weekly health report cadence biweekly sensor availability dashboard uptime observations governance stakeholder' },
      { key: 'benefits', label: 'Benefits Realization Tracker', kw: 'benefits realization business case scale reliability efficiency avoided outage evidence impact tracker' },
      { key: 'go-no-go', label: 'Go / No-Go Report', kw: 'go no-go decision scale up recommendation gates evidence readiness verdict business case expansion estate rollout' },
    ],
  },
  {
    // Its own section, not a corner of Teams: on a data center the document
    // library is primarily an asset library — manuals, drawings, certificates
    // and reports tied to the plant. The representative-manufacturers reference
    // folds in here too, as its second tab: both are the estate's reference
    // library, and one entry reads cleaner than two near-empty ones.
    key: 'documents', single: true, label: 'Documents', icon: 'documents',
    kw: 'documents document intelligence manual drawing wiring diagram p&id calibration certificate commissioning report spare parts asset library upload attachment pdf dwg xlsx manufacturer oem vendor vertiv trane schneider caterpillar cummins representative reference',
  },
]

export const SECTIONS = MENU.flatMap((g) => (
  g.single
    ? [{ key: g.key, label: g.label, group: g.label, kw: g.kw || '' }]
    : g.children.map((c) => ({ key: c.key, label: c.label, group: g.label, kw: c.kw || '' }))
))

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((x) => [x.key, x.label]))
