// Three jobs the R1 EDU is given on a plant floor.
// Seeded so a walk-through has bins, waypoints and findings. Not a live robot log.

export const KITS = [
  {
    id: 'WO-2614',
    title: 'Homogenizer packing change',
    asset: 'Homogenizer 02',
    lines: [
      { part: 'Homogenizer packing set', bin: 'A-14', need: 1, onHand: 2 },
      { part: 'Food-grade grease', bin: 'L-02', need: 1, onHand: 4 },
      { part: 'Plunger seal', bin: 'A-15', need: 2, onHand: 0 },
    ],
  },
  {
    id: 'WO-2620',
    title: 'Filler infeed chain',
    asset: 'Aseptic filler 01',
    lines: [
      { part: 'Drive chain', bin: 'C-03', need: 1, onHand: 1 },
      { part: 'Sprocket', bin: 'C-04', need: 2, onHand: 2 },
    ],
  },
  {
    id: 'WO-2628',
    title: 'CIP spray-ball service',
    asset: 'CIP set 01',
    lines: [
      { part: 'CIP spray ball', bin: 'H-07', need: 1, onHand: 1 },
      { part: 'Gasket set', bin: 'H-08', need: 1, onHand: 3 },
    ],
  },
]

export const WAYPOINTS = [
  { id: 'WP-UHT', name: 'UHT hold tube', pose: 'Line A, bay 2, facing the diversion valve', ready: true },
  { id: 'WP-FILL', name: 'Filler jaw', pose: 'Aseptic filler, jaw station, 1.2 m', ready: true },
  { id: 'WP-CIP', name: 'CIP room', pose: '', ready: false },
  { id: 'WP-ELEC', name: 'Drive panel', pose: 'Electrical room, cabinet 4, door open', ready: true },
]

export const WALK = [
  { id: 'W1', place: 'Wet-mix aisle', note: 'Clear. No finding.' },
  { id: 'W2', place: 'Filler infeed', note: 'Product on the floor under the chain guard.', kind: 'Cleanliness' },
  { id: 'W3', place: 'Homogenizer bay', note: 'Guard fastener missing on the crank cover.', kind: 'Safety' },
  { id: 'W4', place: 'Dryer mezzanine', note: 'Drive chain shiny at the pin ends. Elongation to measure.', kind: 'Maintenance' },
  { id: 'W5', place: 'Dock', note: 'Clear. Robot returns here.' },
]
