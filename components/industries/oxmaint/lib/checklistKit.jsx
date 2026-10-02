'use client'

// The pieces the checklist screens need and productKit does not carry.
//
// productKit holds the chrome the Inspection module wears — summary cards, rate
// cards, the alert band, the list header. The checklist builder needs a
// different set: a modal, a switch, labelled form fields, and the handful of
// glyphs the product draws on a checklist item that have no equivalent in
// productKit's icon table (camera, pen, layers, grip, chevrons).
//
// They live here rather than in productKit because productKit belongs to the
// Inspection screens and a third screen quietly adding to it is how a shared
// file becomes nobody's. They live here rather than three times over because
// all three checklist screens use them and "close enough on three screens" is
// the drift a reviewer notices first.

import { PALETTE } from './kit'
import { Glyph as KitGlyph, Z } from './productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

// Only the ones productKit lacks. Anything it already has is delegated, so
// there is never a second drawing of the same icon.
const EXTRA = {
  camera: <><path d="M4 8h3l1.6-2.2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" /><circle cx="12" cy="14" r="3.4" /></>,
  pen: <><path d="M12 19h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  dots: <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M9 7V4h6v3" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  restore: <><path d="M3 8V4h4" /><path d="M3.5 12A8.5 8.5 0 1 0 6 6.2L3 8" /><path d="M12 8v4.5l3 1.8" /></>,
  sparkle: <><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z" /><path d="M18.5 3v3M20 4.5h-3" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  brain: <><path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.5 2.5 0 0 0-2 4 2.6 2.6 0 0 0 .6 4A2.5 2.5 0 0 0 9 19.5V4.5z" /><path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 2 4 2.6 2.6 0 0 1-.6 4A2.5 2.5 0 0 1 15 19.5V4.5z" /></>,
}

/** productKit's glyph table, extended with the checklist-only marks. */
export function Mark({ name, size = 16, color = 'currentColor', width = 1.9 }) {
  const path = EXTRA[name]
  if (!path) return <KitGlyph name={name} size={size} color={color} width={width} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {path}
    </svg>
  )
}

/**
 * The dialog the builder opens items in.
 *
 * Rendered inline with a fixed backdrop rather than through a portal, because
 * nothing in this portal renders through one and a single component reaching
 * for `createPortal` is a component that behaves differently under the smoke
 * test than the twenty-six around it.
 */
export function Modal({ open, title, onClose, children, width = 720 }) {
  if (!open) return null
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <h3 style={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={styles.iconBtn}>
            <Mark name="x" size={15} color={SUB} />
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
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
        style={{ ...styles.switch, background: checked ? '#15227a' : '#cbd5e1' }}>
        <span style={{ ...styles.knob, transform: `translateX(${checked ? 18 : 2}px)` }} />
      </button>
    </div>
  )
}

/** A white panel with a title — the card the product builds these screens out of. */
export function Panel({ title, icon, right, children, tone, style }) {
  return (
    <section style={{ ...styles.panel, ...style }}>
      {(title || right) && (
        <header style={styles.panelHead}>
          {icon && <Mark name={icon} size={16} color={tone || '#15227a'} />}
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
  // The backdrop is a frame, not a scroller.
  //
  // With `overflowY: auto` here and no height cap on the modal, a tall item
  // form grew past the viewport and the backdrop scrolled the whole thing —
  // which carried the title bar and the close button off the top of the screen.
  // The modal is capped instead, its head pinned, and the body given the only
  // scrollbar.
  backdrop: {
    // Above the sidebar and the sticky top bar, both of which used to paint
    // over this dialog's title. See Z in productKit.
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: Z.modal,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px', overflow: 'hidden',
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%',
    boxShadow: '0 22px 60px rgba(15,23,42,.22)', overflow: 'hidden',
    // Against the backdrop's content box, so it survives a change to that padding.
    display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0,
  },
  modalHead: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px',
    borderBottom: `1px solid ${LINE}`, flexShrink: 0,
  },
  modalTitle: { margin: 0, fontSize: 15.5, fontWeight: 700, color: INK, flex: 1, minWidth: 0 },
  // `minHeight: 0` is what lets this shrink inside the flex column; without it
  // the body keeps its full content height and pushes the modal past its cap.
  modalBody: { padding: '16px 18px 20px', overflowY: 'auto', minHeight: 0, flex: 1 },

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
    background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  panelHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13, flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },

  iconBtn: {
    width: 30, height: 30, display: 'grid', placeItems: 'center', flexShrink: 0,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    borderRadius: 8, cursor: 'pointer', padding: 0,
  },
}
