'use client'

// The checklists a HEPA technician actually works to.
//
// These are not filler steps. The integrity-test procedure follows ISO 14644-3
// Annex B — upstream challenge concentration established first, photometer
// zeroed and referenced against it, then a scan at a defined probe distance and
// traverse rate — because those are the steps whose omission makes a passing
// result meaningless, and they are what an auditor asks the technician to walk
// through.
//
// A run is stored with the filter it was against and who completed it, which is
// what turns a checklist from a memory aid into evidence.
//
// ── the shape ─────────────────────────────────────────────────────────────
//
// The product models a checklist as sections → sub-sections → items, and each
// item carries a response type rather than a tick box. That is not decoration:
// "Probe held 25 mm from the filter face" wants a number and a unit, "Old
// serial number read off the frame" wants text, and a room release wants a
// signature. Flattening all three to pass/fail throws away the only part of the
// record an investigator later reads.
//
// So the eight procedures below are authored as sections and items, and every
// step's wording is carried across unchanged. The grouping is new; the words
// are not, because a plausible-sounding step nobody wrote passes a review and
// fails an inspection.
//
// Response types and acceptance values are only ever taken from the step's own
// wording ("no faster than 50 mm/s") or from the site's own thresholds in
// data/filters.js. Nothing here invents a limit.

import { THRESHOLDS } from './data/filters.js'
import { shift } from './anchor.js'

// What a checklist is — response types, scoring methods, levels, the code a
// checklist is known by — now lives in the general CMMS portal, because none of
// it is about this site. Re-exported here so this portal's screens keep the
// import they already had.
export {
  RESPONSE_TYPES, responseType, SCORING_METHODS, ASSET_LEVELS, LOCATION_TYPES,
  CATEGORIES, codeFor, allItemsOf, allItems,
} from '../../oxmaint/lib/checklistSchema'

import { codeFor, allItemsOf } from '../../oxmaint/lib/checklistSchema'


// The site's own thresholds, quoted rather than restated. The workbook carries
// max penetration as a percentage and the pressure breach in inches water
// gauge, and a checklist that asks for Pa when the gauges read in. wg produces
// readings nobody can compare against the register.
const MAX_PENETRATION = String(THRESHOLDS.penetration.value)
const PRESSURE_UNIT = 'in. wg'

// ── the procedures ────────────────────────────────────────────────────────
//
// Authored compactly and expanded by `build` below, so item numbers, sequences
// and ids are stamped in one place rather than typed eighty times. `text` is
// the step exactly as the site wrote it.

const SOURCE = [
  {
    id: 'dop-pao',
    name: 'DOP/PAO integrity test',
    standard: 'ISO 14644-3 Annex B',
    what: 'The aerosol challenge scan. Run before any certification record is raised.',
    category: 'Certification',
    assetLevel: 'Equipment',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-02-11',
    sections: [
      {
        name: 'Preparation',
        items: [
          { text: 'Room at operational airflow and pressure, stabilised at least 15 minutes.', type: 'Pass_Fail', critical: true },
          { text: 'Aerosol generator upstream of the filter bank, injection point verified.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Challenge and reference',
        items: [
          { text: 'Upstream challenge concentration established and recorded.', type: 'Numeric', unit: 'µg/L', critical: true },
          { text: 'Photometer zeroed on filtered air, then referenced to 100% upstream.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Scan',
        subSections: [
          {
            name: 'Probe and traverse',
            items: [
              { text: 'Probe held 25 mm from the filter face.', type: 'Numeric', unit: 'mm' },
              // The step names its own ceiling, so the acceptable maximum is the
              // step's rather than a figure chosen here.
              { text: 'Scan traverse no faster than 50 mm/s, overlapping passes.', type: 'Numeric', unit: 'mm/s', max: '50' },
            ],
          },
          {
            name: 'Coverage and confirmation',
            items: [
              { text: 'Entire filter face scanned, plus the frame seal and gasket line.', type: 'Pass_Fail', critical: true },
              { text: 'Any indication above threshold re-scanned to confirm before recording.', type: 'Pass_Fail', critical: true, comment: true },
            ],
          },
        ],
      },
      {
        name: 'Record',
        items: [
          { text: 'Downstream penetration recorded against the acceptance criterion.', type: 'Numeric', unit: '%', max: MAX_PENETRATION, critical: true },
          { text: 'Result, scan point count and technician entered on the test record.', type: 'Signature', critical: true },
        ],
      },
    ],
  },

  {
    id: 'changeover',
    name: 'Filter changeover',
    standard: 'Site SOP · chain of custody',
    what: 'The steps a replacement must not skip if the room is to be released afterwards.',
    category: 'Certification',
    assetLevel: 'Equipment',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-01-23',
    sections: [
      {
        name: 'Before removal',
        items: [
          { text: 'Pre-replacement integrity test recorded against the outgoing filter.', type: 'Pass_Fail', critical: true },
          { text: 'Room secured, airflow isolated, area protected for the change.', type: 'Pass_Fail', critical: true },
          { text: 'Old serial number read off the frame and recorded before removal.', type: 'Text', critical: true },
        ],
      },
      {
        name: 'Installation',
        subSections: [
          {
            name: 'Incoming filter',
            items: [
              { text: 'New filter inspected for transit damage; media and frame intact.', type: 'Pass_Fail', critical: true, photo: true },
              { text: "Supplier certificate present and its number matches the new filter's.", type: 'Text', critical: true },
            ],
          },
          {
            name: 'Fitting',
            items: [
              { text: 'New serial number recorded, gasket seated and clamps torqued evenly.', type: 'Text', critical: true },
            ],
          },
        ],
      },
      {
        name: 'Return to service',
        items: [
          { text: 'Airflow restored and room allowed to stabilise.', type: 'Pass_Fail' },
          { text: 'Post-installation integrity test performed and passed.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Release',
        items: [
          { text: 'Replacement record updated with both serials and both test references.', type: 'Text', critical: true },
          { text: 'Room released only after the post-installation test passes.', type: 'Signature', critical: true },
        ],
      },
    ],
  },

  {
    id: 'leak-round',
    name: 'Pressure differential round',
    standard: 'Site SOP · scheduled monitoring',
    what: 'The walking round that produces the leak detection readings.',
    category: 'Facility',
    assetLevel: 'Area',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-03-04',
    sections: [
      {
        name: 'Before the round',
        items: [
          { text: 'Gauge calibration date checked and in date.', type: 'Pass_Fail', critical: true },
          { text: 'Room at operational state; doors closed, no transfer in progress.', type: 'Pass_Fail' },
        ],
      },
      {
        name: 'At each filter',
        items: [
          { text: 'Reading taken at the fixed monitoring point for each filter.', type: 'Numeric', unit: PRESSURE_UNIT },
          { text: 'Value compared against the breach threshold before leaving the room.', type: 'Pass_Fail', critical: true, instruction: `Breach threshold is ${THRESHOLDS.pressureDifferential.value} ${PRESSURE_UNIT}.` },
          { text: 'Any breach re-read to rule out a transient before it is logged.', type: 'Pass_Fail', comment: true },
        ],
      },
      {
        name: 'Recording',
        items: [
          { text: 'Readings entered with the technician id against each one.', type: 'Text' },
          {
            text: 'Breaches escalated the same shift, not at the end of the round.',
            type: 'Selection',
            options: ['No breach found', 'Escalated this shift', 'Escalation outstanding'],
            critical: true,
          },
        ],
      },
    ],
  },

  // ── the checklists the inspection rounds are carried out against ────────
  //
  // The three above are procedures a technician follows at a filter. These five
  // are what somebody walks a room with, and they exist because the Inspection
  // module's rounds have to be carried out against something — a round with no
  // checklist behind it records a result nobody can audit back to a step.
  //
  // Each `roundId` matches a round in lib/data/inspections.js, so starting a
  // round opens the right list rather than a generic one.
  {
    id: 'gowning-audit',
    roundId: 'gowning',
    name: 'Gowning and personnel flow audit',
    standard: 'EU GMP Annex 1 §7',
    what: 'The weekly observation of how people enter and move through the clean area.',
    category: 'Personnel',
    assetLevel: 'Area',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 90,
    issued: '2025-02-27',
    sections: [
      {
        name: 'Ante-room',
        items: [
          { text: 'Gowning sequence poster at the ante-room door is the current revision.', type: 'Pass_Fail' },
          { text: 'Hand hygiene performed before the first garment is touched.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Gowning sequence',
        items: [
          { text: 'Garments taken from sealed packs; no contact with the floor or unclean surfaces.', type: 'Pass_Fail', critical: true },
          { text: 'Sequence followed in order — overshoes, hood, coverall, second gloves, goggles.', type: 'Pass_Fail', critical: true },
          { text: 'Sterile glove change completed before entry to the aseptic core.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Flow and discipline',
        items: [
          { text: 'Airlock doors interlocked; only one open at a time throughout the observation.', type: 'Pass_Fail', critical: true },
          { text: 'Personnel route does not cross the material transfer route.', type: 'Pass_Fail' },
          { text: 'No adjustment of gowning inside the classified area.', type: 'Pass_Fail' },
        ],
      },
      {
        name: 'Exit and close-out',
        items: [
          { text: 'Exit sequence followed and garments disposed of at the designated point.', type: 'Pass_Fail' },
          { text: 'Observations discussed with the shift before the auditor leaves the area.', type: 'Text' },
        ],
      },
    ],
  },

  {
    id: 'pressure-round',
    roundId: 'pressure',
    name: 'Pressure cascade round',
    standard: 'ISO 14644-3 §B.4',
    what: 'The daily walk of the differential across every door in the cascade.',
    category: 'Facility',
    assetLevel: 'Area',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-01-09',
    sections: [
      {
        name: 'Before the round',
        items: [
          { text: 'Gauge calibration date checked and in date before the first reading.', type: 'Pass_Fail', critical: true },
          { text: 'Rooms at operational state; no transfer or door movement in progress.', type: 'Pass_Fail' },
        ],
      },
      {
        name: 'At each door',
        subSections: [
          {
            name: 'Reading',
            items: [
              { text: 'Differential read at each door in the cascade, in cascade order.', type: 'Numeric', unit: PRESSURE_UNIT },
              { text: 'Each reading compared against that door’s design value, not a single site figure.', type: 'Pass_Fail', critical: true },
              { text: 'Direction of flow confirmed — the higher grade is the positive side.', type: 'Pass_Fail', critical: true },
            ],
          },
          {
            name: 'Confirmation',
            items: [
              { text: 'Any reading at the low end of its band re-read before it is recorded.', type: 'Pass_Fail', comment: true },
              { text: 'Door interlock delay observed at one door per suite.', type: 'Numeric', unit: 's' },
            ],
          },
        ],
      },
      {
        name: 'Recording and escalation',
        items: [
          { text: 'Readings entered against the technician id at the point of reading.', type: 'Text' },
          { text: 'A reversal or a below-minimum reading escalated immediately, not at the end of the round.', type: 'Pass_Fail', critical: true },
        ],
      },
    ],
  },

  {
    id: 'housing-inspection',
    roundId: 'housing',
    name: 'Filter housing and seal inspection',
    standard: 'ISO 14644-3 Annex B',
    what: 'The quarterly hands-on check of every terminal filter housing.',
    category: 'Certification',
    assetLevel: 'Equipment',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-04-02',
    sections: [
      {
        name: 'Housing',
        items: [
          { text: 'Housing frame inspected for corrosion, distortion and impact damage.', type: 'Pass_Fail', photo: true },
          { text: 'Gasket seated evenly along its whole line; no displacement or compression set.', type: 'Pass_Fail', critical: true },
          { text: 'Clamp torque checked against the SOP value at every position.', type: 'Numeric', unit: 'N·m' },
        ],
      },
      {
        name: 'Filter',
        items: [
          { text: 'Filter face inspected for media damage, pinholes and separator disturbance.', type: 'Pass_Fail', critical: true, photo: true },
          { text: 'Downstream side clear of debris and free of visible deposit.', type: 'Pass_Fail' },
          { text: 'Filter identification legible and matching the registry record.', type: 'Text' },
        ],
      },
      {
        name: 'Records and follow-up',
        items: [
          { text: 'Last integrity test reference and date confirmed against the record.', type: 'Text' },
          { text: 'Any finding that could breach the seal line raises an integrity test before the room is used.', type: 'Pass_Fail', critical: true, comment: true },
          { text: 'Inspection recorded against the filter, not only against the room.', type: 'Signature' },
        ],
      },
    ],
  },

  {
    id: 'ahu-check',
    roundId: 'ahu',
    name: 'AHU and ductwork check',
    standard: 'Site SOP · mechanical',
    what: 'The monthly mechanical check upstream of the terminal filters.',
    category: 'Facility',
    assetLevel: 'Equipment',
    locationType: 'Building',
    scoringMethod: 'Pass_Fail',
    passingScore: 90,
    issued: '2025-03-19',
    sections: [
      {
        name: 'Filtration',
        items: [
          { text: 'Pre-filter differential read and compared against the change-out point.', type: 'Numeric', unit: PRESSURE_UNIT },
          { text: 'Pre-filters seated with no bypass around the frame.', type: 'Pass_Fail', critical: true },
        ],
      },
      {
        name: 'Coils and drainage',
        items: [
          { text: 'Cooling and heating coil faces clear of debris.', type: 'Pass_Fail' },
          { text: 'Condensate tray draining, no standing water.', type: 'Pass_Fail' },
        ],
      },
      {
        name: 'Fan and dampers',
        items: [
          { text: 'Fan bearings free of abnormal noise; belt tension and condition acceptable.', type: 'Pass_Fail' },
          { text: 'Dampers stroke fully and return to their commanded position.', type: 'Pass_Fail' },
        ],
      },
      {
        name: 'Ductwork and controls',
        subSections: [
          {
            name: 'Ductwork',
            items: [
              { text: 'Duct access panels closed and sealed after the check.', type: 'Pass_Fail' },
              { text: 'No audible leakage downstream of the final filter bank.', type: 'Pass_Fail', critical: true },
            ],
          },
          {
            name: 'Controls',
            items: [
              { text: 'Control setpoints match the room’s qualified values.', type: 'Text', critical: true },
            ],
          },
        ],
      },
      {
        name: 'Close-out',
        items: [
          { text: 'Findings raised as a work order before the unit is left running.', type: 'Pass_Fail', comment: true },
        ],
      },
    ],
  },

  {
    id: 'em-round',
    roundId: 'em',
    name: 'Environmental monitoring round',
    standard: 'EU GMP Annex 1 §9',
    what: 'The weekly viable and non-viable counts at the fixed monitoring locations.',
    category: 'Environmental',
    assetLevel: 'Area',
    locationType: 'Room',
    scoringMethod: 'Pass_Fail',
    passingScore: 100,
    issued: '2025-02-05',
    sections: [
      {
        name: 'Before sampling',
        items: [
          { text: 'Monitoring plan for the room checked; all fixed locations accessible.', type: 'Pass_Fail' },
          { text: 'Particle counter calibration in date and zero-count check passed.', type: 'Pass_Fail', critical: true },
          { text: 'Sample volume and duration set to the values in the plan.', type: 'Text' },
        ],
      },
      {
        name: 'Sampling',
        subSections: [
          {
            name: 'Non-viable',
            items: [
              { text: 'Non-viable counts taken at each fixed location, at working height.', type: 'Numeric', unit: 'particles/m³' },
            ],
          },
          {
            name: 'Viable',
            items: [
              { text: 'Settle plates exposed for the specified period at the specified points.', type: 'Pass_Fail' },
              { text: 'Active air samples taken at the fill point and at the operator position.', type: 'Pass_Fail' },
              { text: 'Contact plates taken from surfaces and from gloved fingertips at exit.', type: 'Pass_Fail', critical: true },
            ],
          },
        ],
      },
      {
        name: 'Assessment and escalation',
        items: [
          { text: 'Counts compared against the alert and action levels for the room’s class.', type: 'Pass_Fail', critical: true },
          { text: 'Any result above the alert level flagged before the technician leaves the room.', type: 'Pass_Fail', comment: true },
          { text: 'Any result above the action level escalated the same shift and the room reviewed.', type: 'Pass_Fail', critical: true, comment: true },
        ],
      },
    ],
  },
]

// ── expansion ─────────────────────────────────────────────────────────────

/** One item, in the shape every screen reads. */
function makeItem(raw, checklistId, containerId, number) {
  return {
    id: `${checklistId}-i${number}`,
    containerId,
    itemNumber: String(number),
    sequence: number,
    description: raw.text,
    responseType: raw.type || 'Pass_Fail',
    instruction: raw.instruction || '',
    unit: raw.unit || '',
    min: raw.min || '',
    max: raw.max || '',
    options: raw.options || [],
    critical: Boolean(raw.critical),
    // Every step in these eight is one the procedure requires. Optional steps
    // exist on authored checklists; none of the site's own has one.
    required: raw.required !== false,
    requiresPhoto: Boolean(raw.photo) || raw.type === 'Photo',
    requiresComment: Boolean(raw.comment),
    requiresSignature: Boolean(raw.signature) || raw.type === 'Signature',
  }
}

function build(raw) {
  let n = 0
  const sections = (raw.sections || []).map((s, si) => {
    const sectionId = `${raw.id}-s${si + 1}`
    return {
      id: sectionId,
      name: s.name,
      sequence: si + 1,
      items: (s.items || []).map((it) => makeItem(it, raw.id, sectionId, (n += 1))),
      subSections: (s.subSections || []).map((ss, ssi) => {
        const subId = `${sectionId}-ss${ssi + 1}`
        return {
          id: subId,
          name: ss.name,
          sequence: ssi + 1,
          instruction: ss.instruction || '',
          items: (ss.items || []).map((it) => makeItem(it, raw.id, subId, (n += 1))),
        }
      }),
    }
  })

  const flat = allItemsOf(sections)

  return {
    ...raw,
    sections,
    code: codeFor(raw.id),
    // The compatibility projection.
    //
    // data/inspections.js and the Inspection Reports screen read a checklist's
    // steps as plain strings, and a run recorded against a step has to keep
    // reading correctly after the checklist behind it is re-sectioned. Derived
    // here rather than authored, so it cannot drift from the sections above.
    items: flat.map((i) => i.description),
    itemCount: flat.length,
    sectionCount: sections.length,
    criticalCount: flat.filter((i) => i.critical).length,
    requiredCount: flat.filter((i) => i.required).length,
    photoCount: flat.filter((i) => i.requiresPhoto).length,
    requiresPhotos: flat.some((i) => i.requiresPhoto),
    requiresSignature: flat.some((i) => i.requiresSignature),
    author: 'Site Quality',
    createdAt: shift(raw.issued),
    version: '1.0',
    archived: false,
    source: 'system',
  }
}



export const TEMPLATES = SOURCE.map(build)

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || null

/** The checklist a given inspection round is carried out against, if there is one. */
export const templateForRound = (roundId) => TEMPLATES.find((t) => t.roundId === roundId) || null
