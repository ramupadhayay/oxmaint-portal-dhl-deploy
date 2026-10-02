'use client'

// The summary row on the product's Work Orders screen.
//
// Nine cards there; seven here. Total Cost and Cost Overruns are the two left
// out, and for the same reason the incident register has no Est. Cost column:
// this workbook carries no money. A cost card reading £0 on every order is
// worse than no cost card — it invites somebody to quote the figure.
//
// Each card is a cut of the list, not an ornament: clicking one narrows the
// orders below it and clicking the active one clears. Which cards a reader
// keeps is remembered, as it is on the product's other registers.

import { PALETTE } from '../lib/kit'
import { Glyph, Menu, MenuCheck, MenuLabel, useCardVisibility, BRAND } from '../lib/productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

/**
 * The product's own set, in its order and under its own ids.
 *
 * `keep` is the cut, written beside the label so a card and the list it opens
 * cannot describe different sets — the failure that is invisible until somebody
 * counts the rows.
 */
export const WO_CARDS = [
  {
    id: 'total', title: 'Total Work Orders', fg: '#475569', bg: '#f1f5f9', icon: 'doc',
    what: 'Every order on the register', keep: () => true,
  },
  {
    id: 'high_priority', title: 'High Priority', fg: '#ca8a04', bg: '#fef9c3', icon: 'zap',
    what: 'Raised above routine', keep: (w) => w.priority === 'High',
  },
  {
    id: 'critical', title: 'Critical Work Orders', fg: '#dc2626', bg: '#fee2e2', icon: 'warning',
    what: 'The barrier is compromised', keep: (w) => w.priority === 'Critical',
  },
  {
    id: 'emergency', title: 'Emergency Work Orders', fg: '#b91c1c', bg: '#fee2e2', icon: 'zap',
    // PM02 is the replacement class: a filter coming out is not planned work,
    // it is the room being taken off line.
    what: 'Replacement — the room is off line', keep: (w) => w.orderClass === 'PM02',
  },
  {
    id: 'preventive', title: 'Preventive Work Orders', fg: '#16a34a', bg: '#dcfce7', icon: 'shield',
    what: 'PM04 — scheduled certification', keep: (w) => w.orderClass === 'PM04',
  },
  {
    id: 'corrective', title: 'Corrective Work Orders', fg: '#2563eb', bg: '#dbeafe', icon: 'wrench',
    what: 'PM01 — raised off a finding', keep: (w) => w.orderClass === 'PM01',
  },
  {
    id: 'approvals', title: 'Pending Approvals', fg: '#ca8a04', bg: '#fef9c3', icon: 'clock',
    what: 'Signed, waiting on a reviewer', keep: (w) => w.status === 'Pending Approval',
  },
]

export default function WorkOrderSummary({ orders, cut, onCut }) {
  const [shown, toggle] = useCardVisibility('hepaWorkOrderVisibleCards', WO_CARDS.map((c) => c.id))
  const cards = WO_CARDS.filter((c) => shown.includes(c.id))

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <Menu icon="sliders" label={`Cards (${shown.length})`}>
          <MenuLabel>Select cards to display</MenuLabel>
          {WO_CARDS.map((c) => (
            <MenuCheck key={c.id} checked={shown.includes(c.id)} onChange={() => toggle(c.id)}>
              {c.title}
            </MenuCheck>
          ))}
        </Menu>
      </div>

      <div style={styles.row}>
        {cards.map((c) => {
          const on = cut === c.id
          return (
            <button key={c.id} onClick={() => onCut(on ? 'total' : c.id)}
              style={{
                ...styles.card,
                borderColor: on ? BRAND[600] : LINE,
                boxShadow: on ? `0 0 0 1px ${BRAND[600]}` : '0 1px 2px rgba(15,23,42,.04)',
              }}>
              <span style={{ ...styles.icon, background: c.bg }}>
                <Glyph name={c.icon} size={18} color={c.fg} />
              </span>
              <span style={styles.value}>{orders.filter(c.keep).length}</span>
              <span style={styles.title}>{c.title}</span>
              <span style={styles.what}>{c.what}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

const styles = {
  row: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: 12, marginBottom: 16,
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    padding: '16px 17px', borderRadius: 12, background: '#fff', minWidth: 0,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  icon: { width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', marginBottom: 12 },
  value: { fontSize: 27, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  title: { fontSize: 12.5, fontWeight: 600, color: SUB, marginTop: 7 },
  what: { fontSize: 11, color: MUTE, marginTop: 3, lineHeight: 1.45 },
}
