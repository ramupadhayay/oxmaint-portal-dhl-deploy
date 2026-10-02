'use client'

// The chrome the Inspection module wears in the product.
//
// Built against the live screens rather than against the other portals in this
// repo. That distinction cost a rewrite: the older CMMS portal here uses a
// header, a KPI strip and a detail drawer, and the product uses none of those
// three on this module. It has a summary-card row you can show and hide, three
// rate cards with their own progress bars, an alert band above the list, and a
// record that opens as its own page.
//
// So the pieces live here, once, and the four screens compose them. Any of them
// re-implemented per screen is a piece that drifts, and "close enough on four
// screens" is what a reviewer notices first.
//
// It lives in the general CMMS portal because that is what it is a copy of —
// the product's own chrome, holding nothing about any one customer. The
// pharmaceutical portal was where it was written and re-exports it under the
// name its screens already import.

import { useEffect, useRef, useState } from 'react'
import { PALETTE } from './kit'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

/**
 * The portal's stacking order, in one place.
 *
 * Modals were written at 60, which is below the sidebar at 200 and below the
 * sticky top bar at 100 — so the app's own chrome painted over the top of every
 * dialog and swallowed its title bar. It read as the dialog being clipped,
 * which sent the first fix at the dialog's height instead of at its z-index.
 *
 * A modal has to sit above everything the page owns. The only thing above it is
 * the save toast, which has to stay readable while a dialog is open.
 */
export const Z = {
  sidebar: 200,
  topBar: 100,
  // Every overlay in this module. One number, so a dialog added later cannot
  // land under the header by picking a plausible-looking value.
  modal: 1000,
  toast: 2000,
}

// The product's own accents, taken off the screens rather than from our palette
// — the rate cards are blue, green and violet and nothing else in this portal
// uses that trio.
/**
 * Four tones, and two of them are the same thing.
 *
 * The product paints this module in six: blue for totals, green for anything
 * healthy, violet for scores, amber and red for trouble, grey for the rest.
 * Rendered together — six summary cards, three rate cards, a badge on every row
 * — it reads as decoration, and a reader who has learned that colour here means
 * nothing stops seeing the two that do.
 *
 * So colour is spent on one thing: a state somebody has to act on. Red for a
 * failure that exists, amber for something overdue or in flight, violet for the
 * ISO 5 aseptic core, where a finding does not mean what it means elsewhere.
 * Everything healthy or merely factual is neutral, because "fine" needs no mark.
 *
 * `blue` and `green` are kept as names and resolve to the neutral so that a call
 * site asking for them gets the right answer rather than an undefined lookup —
 * there are forty of them across six screens and a rename would be forty chances
 * to miss one. New code should ask for `slate`.
 */
/**
 * The product's brand scale, not one shade of it.
 *
 * We were painting everything in `#15227a` — the product calls that its "main
 * primary" but it is the 900 step, the darkest on the ramp, and using it for
 * icons and small marks as well as for filled buttons made the whole module
 * read heavier than the screen it copies.
 *
 * The product spends the ramp: 900 on a filled button or a strong emphasis, 600
 * on the icons and links beside a label, 50 and 100 as tints behind them. Same
 * values, used at the weight each job actually wants.
 */
export const BRAND = {
  50: '#f0f2ff',
  100: '#e6e9ff',
  500: '#6b73ff',
  600: '#4a52f5',
  700: '#3640d8',
  900: '#15227a',
}

const NEUTRAL = { fg: '#475569', bg: '#f8fafc', bd: '#e2e8f0' }

export const TONE = {
  slate: NEUTRAL,
  blue: NEUTRAL,
  green: NEUTRAL,
  amber: { fg: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  red: { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  violet: { fg: '#6d28d9', bg: '#f5f3ff', bd: '#ddd6fe' },
}

const ICONS = {
  clipboard: <><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.3 2.3 4.7-4.7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></>,
  cross: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>,
  warning: <><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  gauge: <><circle cx="12" cy="12" r="9" /><path d="M12 12 8.5 8.5" /><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2" /></>,
  filter: <path d="M3 5h18l-7 8v5.5l-4 2V13z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></>,
  refresh: <><path d="M21 4v6h-6" /><path d="M3 20v-6h6" /><path d="M20 10a8 8 0 0 0-14.1-3.4L3 10M4 14a8 8 0 0 0 14.1 3.4L21 14" /></>,
  pin: <><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  download: <><path d="M12 3v12" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 20h16" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  // The three the product's AI loader steps through — lucide's Cpu, Cog and
  // Zap, redrawn. That panel is watched for the whole of a generation with
  // nothing else on screen, so its icons are the ones worth matching.
  // Two the request screen asks for and this table did not carry — the Total
  // Requests card rendered an empty tile because of it.
  // The work order summary asks for these two.
  zap: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />,
  shield: <><path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6z" /><path d="m9 12 2 2 4-4" /></>,
  chart: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="1" /><rect x="12.5" y="8" width="3" height="10" rx="1" /><rect x="18" y="5" width="3" height="13" rx="1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M9 1.5v2M15 1.5v2M9 20.5v2M15 20.5v2M1.5 9h2M1.5 15h2M20.5 9h2M20.5 15h2" /></>,
  cog: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  // The disk on the product's Save Checklist button.
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  zap: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />,
  up: <path d="m5 15 7-7 7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  flat: <path d="M4 15.5 9 10l3.5 3.5L20 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  play: <path d="m7 4 13 8-13 8z" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.6 6.8-4M8.6 13.4l6.8 4" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5L12 5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5L12 19" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  pulse: <path d="M3 12h4l2.5-7 4 14 2.5-7h5" />,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  box: <><path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7z" /><path d="M3.5 7 12 11.4 20.5 7M12 11.4V21.2" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  // Added for the work order form: one per step in its navigator, plus the
  // handful the step bodies need for their own buttons.
  paperclip: <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" />,
  message: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.35 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.55-4.65A8.5 8.5 0 0 1 12 3.5a8.38 8.38 0 0 1 9 8z" />,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2a2.12 2.12 0 1 0-3-3z" /><path d="M12 15 9 12a11 11 0 0 1 3-7c2.2-2.2 5-2.4 7.5-2 .4 2.5.2 5.3-2 7.5a11 11 0 0 1-7 3z" /><path d="M9 12H5s.44-2.42 1.5-3.5C7.7 7.3 10 8 10 8" /></>,
  bulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-3.5 10.9c.6.5.9 1.2 1 2h5c.1-.8.4-1.5 1-2A6 6 0 0 0 12 2z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  next: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  coins: <><circle cx="8" cy="8" r="5" /><path d="M18.1 4.3a5 5 0 0 1 0 15.4" /><path d="M7 20.7a5 5 0 0 0 8.9-3.9" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
  sparkle: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
}

/** One glyph, in whatever colour and size the caller wants. */
export function Glyph({ name, size = 16, color = 'currentColor', width = 1.9 }) {
  const path = ICONS[name]
  if (!path) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {path}
    </svg>
  )
}

/**
 * The summary-card row.
 *
 * Six of them on the product's inspection screen, each a count with an icon and
 * some with a percentage beside the number. One card can be `active`, which is
 * how the product marks the cut currently applied to the list — so these are
 * buttons, not decoration: clicking one filters, and clicking it again clears.
 *
 * @param cards  [{ key, label, value, pct, tone, icon }]
 * @param active the key currently filtering the list, or null
 */
export function SummaryCards({ cards = [], active, onPick, visible = true }) {
  if (!visible) return null
  return (
    <div style={styles.summaryRow}>
      {cards.map((c) => {
        // Colour is reserved for a count that wants somebody to do something,
        // and only while there is something to do: a red Failed card reading
        // nought is an alarm about the absence of a problem. Everything else
        // is neutral, so the two that are not carry weight.
        const alerting = Boolean(c.alert) && Number(c.value) > 0
        const t = alerting ? (TONE[c.tone] || TONE.amber) : null
        const on = active === c.key
        return (
          <button key={c.key} onClick={() => onPick && onPick(on ? null : c.key)}
            style={{
              ...styles.summaryCard,
              // One accent for "this is the cut you are looking at", the same
              // navy the rest of the portal selects with. Not the card's own
              // colour — selection and severity are different questions and
              // answering both with one border makes neither legible.
              borderColor: on ? BRAND[600] : LINE,
              boxShadow: on ? `0 0 0 1px ${BRAND[600]}` : '0 1px 2px rgba(15,23,42,.04)',
              cursor: onPick ? 'pointer' : 'default',
            }}>
            <div style={styles.summaryTop}>
              <span style={styles.summaryLabel}>{c.label}</span>
              <span style={{
                ...styles.summaryIcon,
                background: t ? t.bg : '#f1f5f9',
                borderColor: t ? t.bd : LINE,
              }}>
                <Glyph name={c.icon} size={15} color={t ? t.fg : MUTE} />
              </span>
            </div>
            <div style={styles.summaryValueRow}>
              <span style={{ ...styles.summaryValue, color: t ? t.fg : INK }}>{c.value}</span>
              {c.pct != null && <span style={styles.pct}>{c.pct}%</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The three rate cards.
 *
 * A percentage, a bar and a sentence saying what the percentage is of. The
 * sentence is the part that earns its place: "33%" on its own invites the
 * reader to guess the denominator, and on this screen the denominator is
 * completed rounds rather than all of them.
 *
 * @param cards [{ key, title, icon, tone, value, suffix, pct, trend, caption }]
 */
export function RateCards({ cards = [] }) {
  return (
    <div style={styles.rateRow}>
      {cards.map((c) => {
        // Three figures side by side, so they are drawn the same way. Giving
        // each its own colour made the row look like three unrelated widgets
        // and said nothing — blue does not mean "completion" to anybody.
        //
        // The arrow is the exception, and only downward. A figure that is
        // healthy needs no mark; one that has fallen below its band is the
        // thing worth spending a colour on.
        const falling = c.trend === 'down'
        const soft = c.trend === 'flat'
        return (
          <div key={c.key} style={styles.rateCard}>
            <div style={styles.rateTop}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Glyph name={c.icon} size={16} color={MUTE} />
                <span style={styles.rateTitle}>{c.title}</span>
              </span>
              {(falling || soft) && (
                <Glyph name={falling ? 'down' : 'flat'} size={15}
                  color={falling ? TONE.red.fg : TONE.amber.fg} />
              )}
            </div>

            <div style={{ ...styles.rateValue, color: falling ? TONE.red.fg : INK }}>
              {c.value}<span style={styles.rateSuffix}>{c.suffix || ''}</span>
            </div>

            <div style={styles.rateTrack}>
              <div style={{
                width: `${Math.max(0, Math.min(100, c.pct))}%`, height: '100%', borderRadius: 999,
                background: falling ? TONE.red.fg : BRAND[600], transition: 'width .25s',
              }} />
            </div>

            <p style={styles.rateCaption}>{c.caption}</p>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The band above the list.
 *
 * The product puts one there when something needs attention now, and it names
 * the count in its title. Rendered as nothing when the count is zero rather
 * than as a green "all clear" — a band that is always present is a band that
 * stops being read.
 */
export function AlertBand({ tone = 'amber', title, children, onClick }) {
  const t = TONE[tone] || TONE.amber
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      style={{
        ...styles.band, background: t.bg, borderColor: t.bd,
        cursor: onClick ? 'pointer' : 'default', width: '100%', textAlign: 'left',
        fontFamily: 'inherit',
      }}>
      <Glyph name="warning" size={17} color={t.fg} />
      <span style={{ minWidth: 0 }}>
        <span style={{ ...styles.bandTitle, color: t.fg }}>{title}</span>
        <span style={styles.bandBody}>{children}</span>
      </span>
    </Tag>
  )
}

/** The [ Overall | By Technician ] control the product puts in the header. */
export function Segmented({ options = [], value, onChange }) {
  return (
    <div style={styles.segmented}>
      {options.map((o) => {
        const on = value === o.key
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{
              ...styles.segment,
              background: on ? '#0f172a' : '#fff',
              color: on ? '#fff' : SUB,
              borderColor: on ? '#0f172a' : LINE,
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A header action: outlined by default, filled navy when `primary`. */
export function Action({ icon, children, onClick, primary, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        ...styles.action,
        background: primary ? BRAND[900] : '#fff',
        color: primary ? '#fff' : SUB,
        borderColor: primary ? BRAND[900] : LINE,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {icon && <Glyph name={icon} size={14} color={primary ? '#fff' : SUB} />}
      {children}
    </button>
  )
}

/**
 * The list's own header: a count, and the controls that act on the list.
 *
 * The count is in the title — "Inspections (19)" — because it is the number
 * that changes when a filter is applied, and a count that lives somewhere else
 * makes the reader work out whether the filter did anything.
 */
export function ListHeader({ icon = 'clipboard', title, count, right }) {
  return (
    <div style={styles.listHeader}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Glyph name={icon} size={17} color={BRAND[600]} />
        <h2 style={styles.listTitle}>{title} ({count})</h2>
      </span>
      {right && <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</span>}
    </div>
  )
}

/** The list/grid pair. */
export function ViewToggle({ value, onChange }) {
  return (
    <div style={styles.toggle}>
      {['list', 'grid'].map((v) => (
        <button key={v} onClick={() => onChange(v)} title={`${v} view`} aria-label={`${v} view`}
          style={{
            ...styles.toggleBtn,
            background: value === v ? BRAND[900] : '#fff',
          }}>
          <Glyph name={v} size={15} color={value === v ? '#fff' : '#94a3b8'} />
        </button>
      ))}
    </div>
  )
}

/** The wide search field that sits under the list header. */
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={styles.searchWrap}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
        <Glyph name="search" size={15} color={MUTE} />
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={styles.search} />
    </div>
  )
}

/**
 * The tinted blocks a record page is made of.
 *
 * The product's record view is not a field table — it is a stack of labelled
 * blocks, each in its own tint, so asset, checklist and notes are told apart at
 * a glance rather than read in order.
 */
export function InfoBlock({ tone = 'slate', icon, label, children, right }) {
  const t = TONE[tone] || TONE.slate
  return (
    <div style={{ ...styles.infoBlock, background: t.bg, borderColor: t.bd }}>
      <div style={styles.infoTop}>
        {icon && <Glyph name={icon} size={14} color={t.fg} />}
        <span style={{ ...styles.infoLabel, color: t.fg }}>{label}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      <div style={styles.infoBody}>{children}</div>
    </div>
  )
}

/** The three white cards across the top of a record page. */
export function FactCards({ items = [] }) {
  return (
    <div style={styles.factRow}>
      {items.map((f) => (
        <div key={f.label} style={styles.factCard}>
          <div style={styles.factLabel}>
            {f.icon && <Glyph name={f.icon} size={13} color="#7c3aed" />}
            {f.label}
          </div>
          <div style={styles.factValue}>{f.value}</div>
          {f.note && <div style={styles.factNote}>{f.note}</div>}
        </div>
      ))}
    </div>
  )
}

/**
 * The panel the product shows where a record has nothing yet.
 *
 * A dashed box saying what is missing and why, rather than an empty area — the
 * live screens use it for results that have not been captured and for analysis
 * that has not been run, and both are ordinary states rather than faults.
 */
export function EmptyPanel({ title, children }) {
  return (
    <div style={styles.emptyPanel}>
      <div style={styles.emptyTitle}>{title}</div>
      {children && <p style={styles.emptyBody}>{children}</p>}
    </div>
  )
}

/**
 * The popover both of the product's list controls open.
 *
 * "Summary Cards (6 visible)" and "Filters" are the same control in the
 * product — a button that drops a panel anchored to its right edge — so they
 * are one component here. Closing on an outside click and on Escape is the part
 * that has to be got right once: a panel that only closes by clicking its own
 * trigger is the sort of thing nobody notices until they try to use the screen
 * behind it.
 */
export function Menu({ label, icon, dot, width = 264, children }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ ...styles.action, background: '#fff', color: SUB, borderColor: open ? BRAND[600] : LINE }}>
        {icon && <Glyph name={icon} size={14} color={SUB} />}
        {label}
        {dot && <span style={styles.dot} />}
      </button>
      {open && (
        <div style={{ ...styles.menu, width }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </span>
  )
}

/** One line of a menu, drawn as a checkbox the way the product's is. */
export function MenuCheck({ checked, onChange, children }) {
  return (
    <button onClick={onChange} style={styles.menuItem}>
      <span style={{ ...styles.checkBox, background: checked ? BRAND[900] : '#fff', borderColor: checked ? BRAND[900] : LINE }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4"
            strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 5 5 9-11" /></svg>
        )}
      </span>
      {children}
    </button>
  )
}

export function MenuLabel({ children }) {
  return <div style={styles.menuLabel}>{children}</div>
}

/**
 * Which summary cards a reader has chosen to see, remembered between visits.
 *
 * The product persists this per screen — `inspectionSummaryVisibleCards`,
 * `incidentAnalyticsVisibleCards` — because hiding four cards you never look at
 * is a choice you make once, and a screen that forgets it every reload is one
 * you stop bothering to configure.
 *
 * Read in an effect rather than in the initialiser. The product reads
 * localStorage while computing initial state, which on a server-rendered page
 * means the server renders all six and the client renders three — a hydration
 * mismatch. Starting from the full set and narrowing after mount renders the
 * same markup on both sides and settles a frame later.
 *
 * Storage can throw outright in a locked-down browser, not merely return null,
 * so both halves are guarded. A reader whose browser refuses to remember still
 * gets a working control.
 *
 * @param key  the storage key, one per screen
 * @param all  every card key, in the order they should appear
 * @returns [shown, toggle] — `toggle(key)` flips one card
 */
export function useCardVisibility(key, all) {
  const [shown, setShown] = useState(all)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) {
        // Filtered against `all`, so a key that has since been renamed or
        // removed cannot resurrect a card the screen no longer has.
        const kept = all.filter((k) => parsed.includes(k))
        if (kept.length) setShown(kept)
      }
    } catch {
      // No storage, or unreadable. The full set is the right answer either way.
    }
    loaded.current = true
    // `all` is a literal at every call site, so this runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const toggle = (cardKey) => setShown((prev) => {
    // One has to stay. A row of no cards is a row of nothing, and the only
    // control that could bring them back sits above an empty space.
    const next = prev.includes(cardKey)
      ? (prev.length > 1 ? prev.filter((k) => k !== cardKey) : prev)
      : all.filter((k) => k === cardKey || prev.includes(k))

    if (loaded.current) {
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Refused. The choice still applies for this visit.
      }
    }
    return next
  })

  return [shown, toggle]
}

/**
 * The pager under the list.
 *
 * Page size belongs beside the range rather than at the far end, because
 * "showing 1 to 50 of 68" and "50 per page" are one sentence read in one
 * glance. The page numbers collapse to an ellipsis past a couple of steps out,
 * which is what stops a long register from wrapping its own pager.
 */
export function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  if (!total) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)

  const numbers = []
  const from = Math.max(2, page + 1 - 2)
  const to = Math.min(pages - 1, page + 1 + 2)
  numbers.push(1)
  if (from > 2) numbers.push('…')
  for (let i = from; i <= to; i += 1) numbers.push(i)
  if (to < pages - 1) numbers.push('…')
  if (pages > 1) numbers.push(pages)

  const step = (n, label, on) => (
    <button key={label} onClick={() => onPage(n)} disabled={!on} aria-label={label} title={label}
      style={{ ...styles.pageBtn, opacity: on ? 1 : 0.4, cursor: on ? 'pointer' : 'default' }}>
      {label}
    </button>
  )

  return (
    <div style={styles.pager}>
      <div style={styles.pagerInfo}>
        <span>Showing {start} to {end} of {total}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Show
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} style={styles.pageSize}>
            {[10, 20, 30, 40, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          per page
        </span>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {step(0, '«', page > 0)}
          {step(page - 1, 'Previous', page > 0)}
          {numbers.map((n, i) => (n === '…'
            ? <span key={`gap${i}`} style={{ padding: '0 4px', color: MUTE, fontSize: 12 }}>…</span>
            : (
              <button key={n} onClick={() => onPage(n - 1)}
                style={{
                  ...styles.pageBtn, minWidth: 34,
                  background: page === n - 1 ? BRAND[900] : '#fff',
                  color: page === n - 1 ? '#fff' : SUB,
                  borderColor: page === n - 1 ? BRAND[900] : LINE,
                }}>{n}</button>
            )))}
          {step(page + 1, 'Next', page < pages - 1)}
          {step(pages - 1, '»', page < pages - 1)}
        </div>
      )}
    </div>
  )
}

/** The pill the product puts beside a record's number. */
export function Pill({ tone = 'slate', children }) {
  const t = TONE[tone] || TONE.slate
  return (
    <span style={{ ...styles.pill, color: t.fg, background: t.bg, borderColor: t.bd }}>{children}</span>
  )
}

const card = {
  background: '#fff', borderRadius: 12,
  borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
}

const styles = {
  summaryRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))',
    gap: 12, marginBottom: 14,
  },
  summaryCard: {
    ...card, padding: '14px 15px', textAlign: 'left', fontFamily: 'inherit',
    display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
  },
  summaryTop: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  summaryLabel: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: SUB, lineHeight: 1.35 },
  summaryIcon: {
    width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, flexShrink: 0,
  },
  summaryValueRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  summaryValue: { fontSize: 27, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  // Neutral. The percentage is context for the number beside it, not a verdict
  // on it, and a tinted pill next to every count is what made the row read as
  // six unrelated states.
  pct: {
    fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
    color: SUB, background: '#f1f5f9',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  rateRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 12, marginBottom: 14,
  },
  rateCard: { ...card, padding: '16px 18px', minWidth: 0 },
  rateTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 },
  rateTitle: { fontSize: 14.5, fontWeight: 700, color: INK },
  rateValue: { fontSize: 32, fontWeight: 800, color: INK, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
  rateSuffix: { fontSize: 20, fontWeight: 700, marginLeft: 1 },
  rateTrack: { height: 6, background: '#eef2f7', borderRadius: 999, overflow: 'hidden', margin: '11px 0 9px' },
  rateCaption: { margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.5 },

  band: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
    borderRadius: 11, borderStyle: 'solid', borderWidth: 1, marginBottom: 16,
  },
  bandTitle: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 2 },
  bandBody: { display: 'block', fontSize: 12, color: SUB, lineHeight: 1.5 },

  segmented: { display: 'flex', borderRadius: 9, overflow: 'hidden', gap: 0 },
  segment: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', whiteSpace: 'nowrap',
  },

  action: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },

  listHeader: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    margin: '18px 0 11px',
  },
  listTitle: { margin: 0, fontSize: 16.5, fontWeight: 700, color: INK },

  toggle: {
    display: 'flex', borderRadius: 9, overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  toggleBtn: {
    width: 34, height: 32, display: 'grid', placeItems: 'center',
    border: 'none', cursor: 'pointer', padding: 0,
  },

  searchWrap: { position: 'relative', marginBottom: 13 },
  search: {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px 11px 36px', fontSize: 13,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 10,
    outline: 'none', fontFamily: 'inherit', color: INK, background: '#fff',
  },

  infoBlock: {
    padding: '12px 14px', borderRadius: 10, borderStyle: 'solid', borderWidth: 1,
    marginBottom: 11,
  },
  infoTop: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 },
  infoLabel: { fontSize: 11.5, fontWeight: 700 },
  infoBody: { fontSize: 13, color: INK, lineHeight: 1.55 },

  factRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 12, marginBottom: 13,
  },
  factCard: { ...card, padding: '13px 15px', minWidth: 0 },
  factLabel: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11.5, fontWeight: 600, color: MUTE, marginBottom: 6,
  },
  factValue: { fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.35 },
  factNote: { fontSize: 11, color: MUTE, marginTop: 3 },

  emptyPanel: {
    padding: '34px 20px', textAlign: 'center', borderRadius: 11,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
    marginBottom: 13,
  },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: SUB },
  emptyBody: { margin: '6px 0 0', fontSize: 12, color: MUTE, lineHeight: 1.55 },

  pill: {
    display: 'inline-block', padding: '3px 9px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, borderStyle: 'solid', borderWidth: 1,
  },

  dot: { width: 7, height: 7, borderRadius: 999, background: BRAND[600], flexShrink: 0 },
  menu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
    background: '#fff', borderRadius: 11, padding: '10px 11px',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 12px 28px rgba(15,23,42,.12)', textAlign: 'left',
  },
  // Sentence case, not the small-caps this portal uses for field labels. The
  // product's DropdownMenuLabel is `text-sm font-medium`, and a menu heading set
  // in uppercase 10px reads as a section marker rather than as the instruction
  // it is. The rule under it is the product's own DropdownMenuSeparator.
  menuLabel: {
    fontSize: 13, fontWeight: 500, color: INK,
    padding: '2px 4px 8px', borderBottom: `1px solid ${LINE}`, marginBottom: 6,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 5px',
    fontSize: 12.5, fontWeight: 600, color: INK, fontFamily: 'inherit',
    background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
  },
  checkBox: {
    width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, flexShrink: 0,
  },

  pager: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    justifyContent: 'space-between', marginTop: 16,
  },
  pagerInfo: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    fontSize: 12, color: SUB,
  },
  pageSize: {
    padding: '5px 8px', fontSize: 12, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 8,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },
  pageBtn: {
    padding: '6px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', color: SUB, borderRadius: 8,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, cursor: 'pointer',
  },
}
