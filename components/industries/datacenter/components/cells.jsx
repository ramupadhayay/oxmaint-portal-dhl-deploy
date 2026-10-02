'use client'

// The three cell renderers every table in this portal uses.
//
// They lived in registers.jsx, which was fine while that was the only file with
// tables in it. The inspection module needs them too, and importing them from
// registers.jsx would have made a cycle — registers.jsx reads the inspection
// configs to build CONFIGS, so inspection.jsx must not read back from it.
// Module-eval cycles in this portal do not fail loudly; they leave a const in
// its temporal dead zone and every screen throws on first render.

import { PALETTE } from '../lib/kit'

const { SUB } = PALETTE

const mono = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB }

/** An identifier. Monospaced so a column of them lines up and a typo is visible. */
export const Mono = ({ children }) => <span style={mono}>{children}</span>

/** Text that wraps instead of truncating — these columns carry engineering
 *  findings, and a clipped finding is useless. */
export const Wrap = ({ children, width = 320 }) => (
  <span style={{ display: 'inline-block', maxWidth: width, whiteSpace: 'normal', lineHeight: 1.45 }}>{children}</span>
)

/** A comma-separated cell, split into its parts. */
export const Chips = ({ values = [] }) => (
  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
    {values.map((v) => <span key={v} style={chip}>{v}</span>)}
  </span>
)

const chip = { fontSize: 10.5, fontWeight: 600, color: '#334155', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 6px' }
