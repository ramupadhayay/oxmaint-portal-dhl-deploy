'use client'

// The pieces the checklist builder needs and the shared kit does not carry.
//
// The kit this portal re-exports has the tables, badges and the modal; what a
// builder needs on top is a labelled field, a switch, a small icon button, a
// white panel, and the handful of glyphs drawn on a checklist item — camera,
// pen, layers, grip, chevrons — that nothing else in this portal draws.
//
// They live here rather than in components/product.jsx because that file
// belongs to the list screens, and a builder quietly adding to it is how a
// shared file becomes nobody's. They live here rather than three times over
// because the create screen, the item dialog and the section block all use
// them, and "close enough on three screens" is the drift a reviewer sees first.
//
// The dialog itself is the shared Modal, not a second one written here. It
// already pins its header, caps its height and scrolls only its body, which is
// what a tall item form needs.

import { PALETTE } from './kit'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const PATHS = {
  check: <path d="m5 13 4 4 10-10" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  gauge: <><path d="M12 14 16 9" /><path d="M20.5 16a9 9 0 1 0-17 0" /><circle cx="12" cy="16" r="1.4" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>,
  camera: <><path d="M4 8h3l1.6-2.2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" /><circle cx="12" cy="14" r="3.4" /></>,
  pen: <><path d="M12 19h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M9 7V4h6v3" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  sparkle: <><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z" /><path d="M18.5 3v3M20 4.5h-3" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></>,
  cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" /></>,
  cog: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  brain: <><path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 6 17a3 3 0 0 0 3.5 3V3z" /><path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 18 17a3 3 0 0 1-3.5 3V3z" /></>,
  site: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
}

export function Mark({ name, size = 16, color = 'currentColor', width = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {PATHS[name] || PATHS.doc}
    </svg>
  )
}

/**
 * Four tones, and two of them are the same thing.
 *
 * The product paints this builder in six: blue for a section's scope, green for
 * a capture requirement, violet for provenance, amber and red for trouble, grey
 * for the rest. Rendered together — a badge on every item, a pill on every
 * section — it reads as decoration, and a reader who has learned that colour
 * here means nothing stops seeing the two that do.
 *
 * So colour is spent on one thing: a state somebody has to act on. Red for an
 * item whose failure fails the round, amber for a draft that needs reviewing.
 * Everything factual is neutral, because "this item is required" is a fact about
 * every item on the sheet and marking all of them marks none of them.
 *
 * The lever is this table rather than the twenty call sites: `blue` and `green`
 * resolve to the neutral, so a screen asking for them gets the right answer
 * instead of an undefined lookup.
 */
const NEUTRAL = { fg: SUB, bg: '#f8fafc', bd: LINE }

export const TONE = {
  slate: NEUTRAL,
  blue: NEUTRAL,
  green: NEUTRAL,
  amber: { fg: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  red: { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  violet: { fg: '#6d28d9', bg: '#f5f3ff', bd: '#ddd6fe' },
}

export function Pill({ tone = 'slate', children }) {
  const t = TONE[tone] || TONE.slate
  return <span style={{ ...styles.pill, color: t.fg, background: t.bg, borderColor: t.bd }}>{children}</span>
}

/** A small bordered button — the one the product's toolbars are made of. */
export function Action({ icon, children, onClick, primary, disabled, title }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        ...styles.action,
        background: primary ? ACCENT : '#fff',
        color: primary ? '#fff' : SUB,
        borderColor: primary ? ACCENT : LINE,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {icon && <Mark name={icon} size={14} color={primary ? '#fff' : SUB} />}
      {children}
    </button>
  )
}

/** A labelled form row. `hint` sits on the right of the label — counters live there. */
export function Field({ label, required, hint, error, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldTop}>
        <span style={styles.label}>
          {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
        </span>
        {hint && <span style={{ ...styles.hint, color: error ? '#dc2626' : MUTE }}>{hint}</span>}
      </span>
      {children}
      {error && <span style={styles.error}>{error}</span>}
    </label>
  )
}

export function TextInput({ invalid, style, ...rest }) {
  return <input {...rest} style={{ ...styles.input, ...(invalid ? styles.invalid : null), ...style }} />
}

export function TextArea({ invalid, style, ...rest }) {
  return <textarea {...rest} style={{ ...styles.input, resize: 'vertical', lineHeight: 1.55, ...(invalid ? styles.invalid : null), ...style }} />
}

export function Picker({ value, onChange, options = [], placeholder, style }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...styles.input, cursor: 'pointer', ...style }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  )
}

/** The product's switch: a label, one line saying what it does, and the toggle. */
export function Toggle({ label, what, checked, onChange }) {
  return (
    <div style={styles.toggleRow}>
      <span style={{ minWidth: 0 }}>
        <span style={styles.toggleLabel}>{label}</span>
        {what && <span style={styles.toggleWhat}>{what}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        style={{ ...styles.switch, background: checked ? ACCENT : '#cbd5e1' }}>
        <span style={{ ...styles.knob, transform: `translateX(${checked ? 18 : 2}px)` }} />
      </button>
    </div>
  )
}

/** A white panel with a title — the card the product builds these screens out of. */
export function Panel({ title, icon, right, children, style }) {
  return (
    <section style={{ ...styles.panel, ...style }}>
      {(title || right) && (
        <header style={styles.panelHead}>
          {icon && <Mark name={icon} size={16} color={ACCENT} />}
          {title && <h3 style={styles.panelTitle}>{title}</h3>}
          {right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

/** A small square icon button — edit, delete, add, collapse. */
export function IconButton({ icon, onClick, title, tone = SUB, disabled }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled}
      style={{ ...styles.iconBtn, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      <Mark name={icon} size={15} color={tone} />
    </button>
  )
}

export const styles = {
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  fieldTop: { display: 'flex', alignItems: 'baseline', gap: 10 },
  label: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: SUB },
  hint: { fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  error: { fontSize: 11.5, color: '#dc2626', fontWeight: 600 },

  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13,
    color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
  },
  invalid: { borderColor: '#fca5a5', background: '#fffafa' },

  toggleRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 10,
  },
  toggleLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  toggleWhat: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.4 },
  switch: {
    width: 38, height: 22, borderRadius: 999, border: 'none', padding: 0,
    cursor: 'pointer', flexShrink: 0, marginLeft: 'auto', position: 'relative',
    transition: 'background .15s',
  },
  knob: {
    position: 'absolute', top: 2, left: 0, width: 18, height: 18, borderRadius: 999,
    background: '#fff', transition: 'transform .15s', boxShadow: '0 1px 2px rgba(15,23,42,.25)',
  },

  panel: {
    background: '#fff', borderRadius: 12, padding: 16, marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  panelHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: INK },

  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0, borderRadius: 8, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, flexShrink: 0,
  },

  action: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },

  pill: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    fontSize: 10.5, fontWeight: 700, borderRadius: 999, whiteSpace: 'nowrap',
    borderStyle: 'solid', borderWidth: 1,
  },
}
