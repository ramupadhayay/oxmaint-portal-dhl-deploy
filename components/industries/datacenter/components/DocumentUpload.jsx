'use client'

// Add a document to the library from a file on your computer.
//
// Pick a file — a manual, a drawing, a certificate, a spreadsheet — and the
// modal reads its name, type and size straight off it, so the row reads like the
// real thing rather than something typed by hand. The file itself is not shipped
// anywhere (this PoC has no blob store); what is recorded is the document's
// details and which asset it belongs to, which is what a document register is.

import { useRef, useState } from 'react'
import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN } = PALETTE

const ACCEPT = '.pdf,.csv,.xlsx,.xls,.dwg,.doc,.docx,.png,.jpg,.jpeg,.txt'
const TYPE_BY_EXT = {
  pdf: 'PDF', csv: 'CSV', xlsx: 'XLSX', xls: 'XLSX', dwg: 'DWG',
  doc: 'DOCX', docx: 'DOCX', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', txt: 'TXT',
}
const size = (kb) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

export default function DocumentUpload({ open, onClose, assets = [], categories = [], onCreate }) {
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  if (!open) return null

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    const base = f.name.replace(/\.[^.]+$/, '')
    setFile({ name: f.name, type: TYPE_BY_EXT[ext] || (ext ? ext.toUpperCase() : 'FILE'), sizeKb: Math.max(1, Math.round(f.size / 1024)) })
    setForm((p) => ({ ...p, document_name: p.document_name || base }))
  }

  const docName = form.document_name?.trim()
  const canSave = Boolean(file && docName)

  const submit = async () => {
    if (!canSave || busy) return
    setBusy(true)
    try {
      const asset = assets.find((a) => a.assetId === form.asset_id)
      await onCreate({
        document_name: docName,
        document_type: file.type,
        category: form.category || 'Manual',
        asset_id: form.asset_id || '',
        asset_name: asset?.assetName || '—',
        manufacturer: asset?.manufacturer || '—',
        size_kb: file.sizeKb,
        uploaded_by_name: form.uploaded_by_name?.trim() || 'Site Engineering',
      })
      reset(); onClose()
    } finally { setBusy(false) }
  }

  const reset = () => { setFile(null); setForm({}); if (fileRef.current) fileRef.current.value = '' }
  const close = () => { reset(); onClose() }

  return (
    <div style={styles.backdrop} onClick={busy ? undefined : close}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <div>
            <h3 style={styles.title}>Upload a document</h3>
            <p style={styles.sub}>Choose a file from your computer — its name, type and size are read from it.</p>
          </div>
          <button onClick={close} style={styles.x} aria-label="Close">✕</button>
        </div>

        <label style={{ ...styles.drop, borderColor: file ? GREEN : `${ACCENT}66`, background: file ? '#f0fdf4' : '#f8fafc' }}>
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} style={{ display: 'none' }} />
          {file ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{file.name}</div>
              <div style={{ fontSize: 11.5, color: SUB, marginTop: 3 }}>{file.type} · {size(file.sizeKb)} · click to change</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Choose a file</div>
              <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>PDF, CSV, XLSX, DWG, DOCX, images</div>
            </div>
          )}
        </label>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <Field label="Document name" required>
            <input value={form.document_name || ''} onChange={(e) => set('document_name', e.target.value)} placeholder="e.g. Chiller 01 — O&M Manual" style={styles.input} />
          </Field>
          <div style={styles.two}>
            <Field label="Category">
              <select value={form.category || ''} onChange={(e) => set('category', e.target.value)} style={styles.input}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Uploaded by">
              <input value={form.uploaded_by_name || ''} onChange={(e) => set('uploaded_by_name', e.target.value)} placeholder="Your name" style={styles.input} />
            </Field>
          </div>
          <Field label="Asset (optional)">
            <select value={form.asset_id || ''} onChange={(e) => set('asset_id', e.target.value)} style={styles.input}>
              <option value="">Not asset-specific</option>
              {assets.slice(0, 60).map((a) => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
            </select>
          </Field>
        </div>

        <div style={styles.foot}>
          <button onClick={close} style={styles.cancel}>Cancel</button>
          <button onClick={submit} disabled={!canSave || busy} style={{ ...styles.save, opacity: !canSave || busy ? 0.55 : 1 }}>
            {busy ? 'Adding…' : 'Add to library'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: SUB }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</span>
      {children}
    </label>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 20px', overflowY: 'auto' },
  card: { width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', padding: 24 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: INK },
  sub: { margin: '4px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.5 },
  x: { border: 'none', background: 'none', fontSize: 15, color: MUTE, cursor: 'pointer', fontFamily: 'inherit' },
  drop: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 96, padding: '18px', border: '1.5px dashed', borderRadius: 12, cursor: 'pointer' },
  two: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', color: INK, border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none', background: '#fff' },
  foot: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  cancel: { padding: '9px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer' },
  save: { padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: '#15227a', border: '1px solid #15227a', borderRadius: 9, color: '#fff', cursor: 'pointer' },
}
