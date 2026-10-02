'use client'

// Attach the evidence for a completed compliance task.
//
// The workbook's own README says to hold evidence files in a document repository
// and keep only their reference against a completion, and the portal did exactly
// that: an "evidence reference" text box and nothing else. The client asked for
// the file itself, so the portal now holds it — and the two are kept as separate
// claims on the form, because they are separate claims. A reference points at a
// file somewhere else; an attachment is a file this portal is holding. Merging
// them into one control would leave a reader unable to tell which one they have.
//
// The cap is real rather than advisory. Records live in a single Mongo document
// whose ceiling is 16 MB, and base64 costs a third on top of the file, so 6 MB
// is where a file stops being evidence and starts being a liability. The size is
// checked here for a civil message, and again on the server — where it is
// checked against the Content-Length header before the body is read, because a
// route handler that parses first has already spent the memory.

import { useRef, useState } from 'react'
import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN, RED } = PALETTE

export const MAX_FILE_BYTES = 6 * 1024 * 1024
export const MAX_FILES = 5

// What a regulator's evidence actually looks like: the filing receipt, the
// stamped form, the lab report, the spreadsheet behind a summary, the email
// confirming submission.
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.txt,.eml,.msg'
const TYPE_BY_EXT = {
  pdf: 'PDF', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', csv: 'CSV',
  xlsx: 'XLSX', xls: 'XLSX', doc: 'DOC', docx: 'DOC', txt: 'TXT',
  eml: 'EMAIL', msg: 'EMAIL',
}

export const prettySize = (bytes) => {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export const typeOf = (name = '') => {
  const ext = (String(name).split('.').pop() || '').toLowerCase()
  return TYPE_BY_EXT[ext] || (ext ? ext.toUpperCase() : 'FILE')
}

/** Read a File into the two halves the record stores: mime and raw base64. */
function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error(`${file.name} could not be read.`))
    r.onload = () => {
      const url = String(r.result || '')
      const comma = url.indexOf(',')
      if (comma < 0) return reject(new Error(`${file.name} could not be read.`))
      resolve({
        fileName: file.name,
        // Some browsers hand back an empty type for .msg and .dwg. The extension
        // is what the viewer falls back to, so the record keeps both.
        mimeType: file.type || (url.slice(5, url.indexOf(';')) || 'application/octet-stream'),
        fileType: typeOf(file.name),
        sizeBytes: file.size,
        fileB64: url.slice(comma + 1),
      })
    }
    r.readAsDataURL(file)
  })
}

export default function EvidenceUpload({ files = [], onChange, disabled = false }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const pick = async (e) => {
    const picked = [...(e.target.files || [])]
    if (inputRef.current) inputRef.current.value = ''
    if (!picked.length) return

    setError('')
    setBusy(true)
    try {
      const room = MAX_FILES - files.length
      // Say what was dropped rather than silently taking the first few — a file
      // a user believes they attached is worse than one they know they did not.
      const tooMany = picked.length > room ? picked.slice(room) : []
      const oversize = picked.slice(0, room).filter((f) => f.size > MAX_FILE_BYTES)
      const usable = picked.slice(0, room).filter((f) => f.size <= MAX_FILE_BYTES)

      const read = []
      for (const f of usable) read.push(await readFile(f))
      if (read.length) onChange([...files, ...read])

      const problems = [
        oversize.length && `${oversize.map((f) => f.name).join(', ')} — over ${prettySize(MAX_FILE_BYTES)}`,
        tooMany.length && `${tooMany.length} more not added — ${MAX_FILES} files is the limit`,
      ].filter(Boolean)
      if (problems.length) setError(problems.join(' · '))
    } catch (err) {
      setError(err.message || 'That file could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const remove = (i) => { setError(''); onChange(files.filter((_, n) => n !== i)) }
  const full = files.length >= MAX_FILES

  return (
    <div>
      <label
        style={{
          ...styles.drop,
          borderColor: files.length ? GREEN : `${ACCENT}55`,
          background: files.length ? '#f0fdf4' : '#f8fafc',
          cursor: disabled || full || busy ? 'default' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <input
          ref={inputRef} type="file" accept={ACCEPT} multiple
          disabled={disabled || full || busy}
          onChange={pick} style={{ display: 'none' }}
        />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={full ? MUTE : ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: full ? MUTE : ACCENT }}>
          {busy ? 'Reading…' : full ? `${MAX_FILES} files attached` : files.length ? 'Attach another file' : 'Attach a file'}
        </span>
        <span style={{ fontSize: 10.5, color: MUTE }}>
          PDF, image, spreadsheet, document or email · up to {prettySize(MAX_FILE_BYTES)} each
        </span>
      </label>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f, i) => (
            <div key={`${f.fileName}-${i}`} style={styles.row}>
              <span style={styles.badge}>{f.fileType}</span>
              <span style={styles.name} title={f.fileName}>{f.fileName}</span>
              <span style={{ fontSize: 11, color: MUTE, flexShrink: 0 }}>{prettySize(f.sizeBytes)}</span>
              <button type="button" onClick={() => remove(i)} disabled={disabled} style={styles.x} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '16px 14px', borderRadius: 10, textAlign: 'center',
    borderStyle: 'dashed', borderWidth: 1.5,
  },
  error: {
    marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.5,
    background: '#fef2f2', color: '#b91c1c',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
    background: '#fff', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  badge: {
    flexShrink: 0, padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
    letterSpacing: 0.3, color: SUB, background: '#f1f5f9',
  },
  name: {
    flex: 1, minWidth: 0, fontSize: 12, color: INK, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  x: {
    flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
    background: '#fff', color: RED, fontSize: 11, lineHeight: 1, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
}
