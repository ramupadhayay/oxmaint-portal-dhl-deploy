'use client'

// The evidence held against one filing — listed, previewed and downloadable.
//
// The list is drawn from metadata the portal already has: an attachment's name,
// type, size and uploader ride the ordinary record load, and only the bytes are
// held back. So the modal opens instantly with everything a reader needs to
// decide which file they want, and the payload is fetched for the one they open.
//
// PDFs and images preview in place because that is what a compliance reviewer is
// usually checking — did the right receipt get filed. Everything else gets a
// download button, rather than an iframe that renders a spreadsheet as a wall of
// mojibake and leaves the reader unsure whether the file is corrupt.

import { useEffect, useState } from 'react'
import { Modal, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { Blank } from './cells'
import { useStore } from '../lib/store'
import { attachmentUrl, downloadUrl } from '../lib/filing'
import { prettySize } from './EvidenceUpload'
import { fmtDate } from '../lib/data'

const { INK, SUB, MUTE, LINE } = PALETTE

const TYPE_TONE = { PDF: 'red', IMG: 'amber', CSV: 'green', XLSX: 'green', DOC: 'blue', EMAIL: 'violet', TXT: 'grey' }
const previewable = (row) => row.fileType === 'PDF' || row.fileType === 'IMG'

export default function EvidenceViewer({ filing, attachments = [], onClose }) {
  const store = useStore()
  const [openRow, setOpenRow] = useState(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // One object URL alive at a time, revoked when the preview changes or the
  // modal closes — an un-revoked blob URL holds its bytes for the life of the
  // document, which on this screen means for the life of the session.
  useEffect(() => {
    if (!openRow) return undefined
    let live = true
    let made = ''
    setLoading(true)
    store.loadAttachment(openRow.recordId).then((row) => {
      if (!live) return
      made = row ? attachmentUrl(row) : ''
      setUrl(made || '')
      setLoading(false)
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
      setUrl('')
    }
  }, [openRow, store])

  const save = async (row) => {
    const full = await store.loadAttachment(row.recordId)
    if (!full) return
    const u = attachmentUrl(full)
    if (!u) return
    downloadUrl(u, row.fileName)
    // Revoked on the next tick rather than immediately: the click is
    // synchronous but the browser reads the URL after this frame.
    setTimeout(() => URL.revokeObjectURL(u), 4000)
  }

  if (!filing) return null

  return (
    <Modal
      open
      onClose={onClose}
      title="Evidence held against this filing"
      subtitle={filing.title}
      width={openRow ? 820 : 560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            Filed {fmtDate(filing.filedDate)} by {filing.filedBy || '—'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {openRow && <ActionButton variant="ghost" onClick={() => setOpenRow(null)}>Back to list</ActionButton>}
            <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
          </div>
        </div>
      )}
    >
      {attachments.length === 0 ? (
        <div style={{ padding: '18px 2px' }}>
          <Blank label="No files were attached to this filing" />
          {filing.evidenceRef ? (
            <p style={styles.refNote}>
              It carries an evidence reference instead — <b>{filing.evidenceRef}</b> — which points at a
              file held in your own document repository rather than in the portal.
            </p>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {attachments.map((a) => (
              <div
                key={a.recordId}
                style={{ ...styles.row, borderColor: openRow?.recordId === a.recordId ? '#c7d2fe' : LINE }}
              >
                <StatusBadge tone={TYPE_TONE[a.fileType] || 'grey'}>{a.fileType}</StatusBadge>
                <span style={styles.name} title={a.fileName}>{a.fileName}</span>
                <span style={styles.meta}>{prettySize(a.sizeBytes)}</span>
                <span style={styles.meta}>{a.uploadedBy || '—'}</span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {previewable(a) && (
                    <ActionButton size="sm" variant="subtle" onClick={() => setOpenRow(a)}>View</ActionButton>
                  )}
                  <ActionButton size="sm" variant="ghost" onClick={() => save(a)}>Download</ActionButton>
                </span>
              </div>
            ))}
          </div>

          {openRow && (
            <div style={styles.preview}>
              {loading && <div style={styles.loading}>Opening {openRow.fileName}…</div>}
              {!loading && url && openRow.fileType === 'IMG' && (
                <img src={url} alt={openRow.fileName} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
              )}
              {!loading && url && openRow.fileType === 'PDF' && (
                <iframe src={url} title={openRow.fileName} style={{ width: '100%', height: 460, border: 'none' }} />
              )}
              {!loading && !url && <div style={styles.loading}>That file could not be opened.</div>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

const styles = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
    background: '#fff', borderRadius: 9, borderStyle: 'solid', borderWidth: 1,
  },
  name: {
    flex: 1, minWidth: 0, fontSize: 12.5, color: INK, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: 11, color: MUTE, flexShrink: 0 },
  preview: {
    padding: 10, borderRadius: 10, background: '#f8fafc',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, minHeight: 120,
  },
  loading: { padding: '32px 0', textAlign: 'center', fontSize: 12, color: SUB },
  refNote: { margin: '10px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 },
}
