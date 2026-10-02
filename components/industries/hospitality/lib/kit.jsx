'use client'

// The CMMS kit, unchanged.
//
// This portal is a hotel's copy of the same product, so it uses the same table,
// toolbar, badges and charts rather than a second set that drifts. The CMMS
// portal's kit already re-exports the shared iFactory primitives on top of its
// own, so one line carries both.

export * from '../../oxmaint/lib/kit'

// Two pieces come from the FSM portal instead, and on purpose.
//
// The shared kit's `PageHeader` was built for a different console — a 44px icon
// tile, a 22px title, a pale subtitle — and its `StatStrip` is four plain
// numbers in a row. Oxmaint's own screens open with a 30px title and a row of
// cards carrying an icon each. The FSM portal had already rebuilt both to match
// the product, with the reasoning written into them, so this imports them
// rather than making a third version that drifts from both.
//
// Safe to import across portals because neither reads any data: they take a
// title, a list of `{label, value, unit, note, tone}` and render. `StatCards`
// takes exactly the shape `StatStrip` did, which is what made the swap
// mechanical.
export { default as PageHeading } from '../../datacenter/components/PageHeading'
export {
  default as MetricCard,
  StatCards,
  MetricGrid,
  Glyph,
  iconForLabel,
} from '../../datacenter/components/MetricCard'
