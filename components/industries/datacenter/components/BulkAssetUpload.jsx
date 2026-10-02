'use client'

// Bulk asset upload — paste a CSV or choose a file, see it validated row by row,
// then create the valid ones in one go.
//
// The register is normally the client's fixed scope matrix, so this is a
// deliberate, explicit door: it parses the columns the register needs, checks
// each row against the estate's real sites and the criticality vocabulary, flags
// what is wrong and why, and only creates the rows that pass. Nothing is written
// until the preview is confirmed, and a bad row never silently becomes a blank
// asset on the wall.

import { useMemo, useRef, useState } from 'react'
import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE, GREEN, RED, ACCENT } = PALETTE

const COLUMNS = ['assetId', 'assetName', 'assetClass', 'siteId', 'criticality', 'manufacturer']
const REQUIRED = ['assetId', 'assetName', 'assetClass', 'siteId', 'criticality']
const CRITICALITIES = ['Critical', 'High', 'Medium', 'Low']

// A small CSV reader — quoted fields, escaped quotes, CRLF or LF. No dependency
// for what is a dozen lines, and no surprise from a library's own dialect.
function parseCsv(text) {
  const rows = []
  let cur = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      cur.push(field); rows.push(cur); cur = []; field = ''
    } else field += ch
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const SAMPLE = [
  'assetId,assetName,assetClass,siteId,criticality,manufacturer',
  'IAD35-CHIL-02,Chiller 02 - IAD35,Chiller,IAD35,Critical,Trane',
  'ORD12-UPS-02,UPS System 02 - ORD12,UPS,ORD12,Critical,Vertiv (Liebert)',
  'LHR10-CRAH-02,CRAH Unit 02 - LHR10,CRAH,LHR10,High,Vertiv (Liebert)',
  'SIN11-PUMP-02,Chilled Water Pump 02 - SIN11,Pump,SIN11,Medium,Grundfos',
].join('\n')

export default function BulkAssetUpload({ open, onClose, existingIds, siteIds, siteLabels, onCreate }) {
  const [text, setText] = useState('')
  const [step, setStep] = useState('input') // input | done
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(0)
  const fileRef = useRef(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    const rows = parseCsv(text)
    if (!rows.length) return null
    const header = rows[0].map((h) => h.trim())
    const idx = {}
    COLUMNS.forEach((c) => { idx[c] = header.findIndex((h) => h.toLowerCase() === c.toLowerCase()) })
    const missingCols = REQUIRED.filter((c) => idx[c] < 0)
    const seen = new Set()
    const data = rows.slice(1).map((cells, i) => {
      const get = (c) => (idx[c] >= 0 ? (cells[idx[c]] || '').trim() : '')
      const row = { assetId: get('assetId'), assetName: get('assetName'), assetClass: get('assetClass'), siteId: get('siteId'), criticality: get('criticality'), manufacturer: get('manufacturer') }
      const errs = []
      REQUIRED.forEach((c) => { if (!row[c]) errs.push(`${c} is blank`) })
      if (row.siteId && !siteIds.includes(row.siteId)) errs.push(`unknown site ${row.siteId}`)
      if (row.criticality && !CRITICALITIES.includes(row.criticality)) errs.push(`criticality must be one of ${CRITICALITIES.join(', ')}`)
      if (row.assetId) {
        if (existingIds.has(row.assetId)) errs.push('asset id already exists')
        else if (seen.has(row.assetId)) errs.push('duplicate id in this upload')
        seen.add(row.assetId)
      }
      return { ...row, _line: i + 2, _errs: errs, _ok: errs.length === 0 }
    })
    return { missingCols, data, valid: data.filter((r) => r._ok) }
  }, [text, existingIds, siteIds])

  if (!open) return null

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result || ''))
    reader.readAsText(f)
  }

  const submit = async () => {
    if (!parsed?.valid.length || busy) return
    setBusy(true)
    try {
      const n = await onCreate(parsed.valid)
      setCreated(n ?? parsed.valid.length)
      setStep('done')
    } finally { setBusy(false) }
  }

  const reset = () => { setText(''); setStep('input'); setCreated(0); if (fileRef.current) fileRef.current.value = '' }
  const close = () => { reset(); onClose() }

  return (
    <div style={styles.backdrop} onClick={busy ? undefined : close}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <div>
            <h3 style={styles.title}>Bulk asset upload</h3>
            <p style={styles.sub}>Add many assets at once from a CSV. Every row is checked before anything is created.</p>
          </div>
          <button onClick={close} style={styles.x} aria-label="Close">✕</button>
        </div>

        {step === 'done' ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={styles.tick}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: INK }}>{created} asset{created === 1 ? '' : 's'} added</h3>
            <p style={{ margin: '0 auto', maxWidth: 340, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
              They are on the register now — search, filter and open them like any other. They persist, and read as in-scope unless the CSV said otherwise.
            </p>
            <div style={styles.foot}>
              <button onClick={reset} style={styles.ghost}>Upload more</button>
              <button onClick={close} style={styles.primary}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.guide}>
              <span style={styles.guideK}>Columns</span>
              <code style={styles.code}>assetId, assetName, assetClass, siteId, criticality, manufacturer</code>
              <button onClick={() => setText(SAMPLE)} style={styles.linkBtn}>Load sample</button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Paste CSV here — first row is the header.\n\n' + SAMPLE}
              rows={7}
              style={styles.textarea}
            />

            <div style={styles.row}>
              <label style={styles.fileBtn}>
                Choose CSV file
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
              </label>
              {text && <button onClick={() => setText('')} style={styles.linkBtn}>Clear</button>}
            </div>

            {parsed && (
              <div style={{ marginTop: 6 }}>
                {parsed.missingCols.length > 0 ? (
                  <div style={styles.bad}>Missing required column{parsed.missingCols.length > 1 ? 's' : ''}: {parsed.missingCols.join(', ')}. Check the header row.</div>
                ) : (
                  <>
                    <div style={styles.counts}>
                      <span style={{ color: GREEN, fontWeight: 700 }}>{parsed.valid.length} ready</span>
                      {parsed.data.length - parsed.valid.length > 0 && (
                        <span style={{ color: RED, fontWeight: 700 }}>{parsed.data.length - parsed.valid.length} with errors</span>
                      )}
                      <span style={{ color: MUTE }}>· {parsed.data.length} row{parsed.data.length === 1 ? '' : 's'} parsed</span>
                    </div>
                    <div style={styles.preview}>
                      {parsed.data.map((r) => (
                        <div key={r._line} style={{ ...styles.pRow, background: r._ok ? '#fff' : '#fef2f2' }}>
                          <span style={{ ...styles.pMark, color: r._ok ? GREEN : RED }}>{r._ok ? '✓' : '✗'}</span>
                          <span style={styles.pId}>{r.assetId || <em style={{ color: MUTE }}>—</em>}</span>
                          <span style={styles.pName}>{r.assetName || <em style={{ color: MUTE }}>—</em>}</span>
                          <span style={styles.pMeta}>{[r.assetClass, r.siteId, r.criticality].filter(Boolean).join(' · ')}</span>
                          {!r._ok && <span style={styles.pErr}>{r._errs.join('; ')}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={styles.foot}>
              <button onClick={close} style={styles.ghost}>Cancel</button>
              <button onClick={submit} disabled={!parsed?.valid.length || busy} style={{ ...styles.primary, opacity: !parsed?.valid.length || busy ? 0.5 : 1 }}>
                {busy ? 'Creating…' : parsed?.valid.length ? `Create ${parsed.valid.length} asset${parsed.valid.length === 1 ? '' : 's'} →` : 'Create assets →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 20px', overflowY: 'auto' },
  card: { width: '100%', maxWidth: 620, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', padding: 24 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: INK },
  sub: { margin: '4px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.5 },
  x: { border: 'none', background: 'none', fontSize: 15, color: MUTE, cursor: 'pointer', fontFamily: 'inherit' },

  guide: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: 11.5 },
  guideK: { fontSize: 10, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5 },
  code: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11, color: INK, background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 6, padding: '3px 8px' },

  textarea: { width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontSize: 12, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: INK, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, outline: 'none', resize: 'vertical', lineHeight: 1.6 },
  row: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 },
  fileBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: '#fff', border: `1px dashed ${ACCENT}66`, borderRadius: 9, color: ACCENT, cursor: 'pointer' },
  linkBtn: { fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' },

  counts: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, margin: '6px 0 8px', flexWrap: 'wrap' },
  preview: { maxHeight: 240, overflowY: 'auto', border: `1px solid ${LINE}`, borderRadius: 10 },
  pRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderBottom: `1px solid #f1f5f9`, fontSize: 11.5, flexWrap: 'wrap' },
  pMark: { fontWeight: 800, width: 12, flexShrink: 0 },
  pId: { fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, color: ACCENT, minWidth: 120 },
  pName: { color: INK, fontWeight: 600, flex: 1, minWidth: 100 },
  pMeta: { color: SUB },
  pErr: { color: RED, fontWeight: 600, flexBasis: '100%', paddingLeft: 21 },

  bad: { fontSize: 12.5, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 13px' },

  foot: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 18 },
  primary: { padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: '#15227a', border: '1px solid #15227a', borderRadius: 9, color: '#fff', cursor: 'pointer' },
  ghost: { padding: '9px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer' },
  tick: { width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
}
