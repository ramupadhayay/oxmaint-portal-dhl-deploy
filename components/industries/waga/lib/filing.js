'use client'

// Writing a filing, once, for the three screens that can raise one.
//
// The calendar, the requirements register and the requirement detail page all
// record the same thing and must record it identically — a filing that reads
// differently depending on which screen raised it is a compliance record you
// cannot report from. So the write lives here and the screens supply only the
// words for their own audit line.
//
// The order matters and is deliberate. The filing is written first and the
// attachments after it, each carrying the filing's own recordId. If the filing
// fails nothing else is attempted; if an attachment fails the filing stands and
// the caller is told which file did not save. The alternative — unwinding a
// successful filing because one PDF was too large — would throw away the record
// of work that was actually done, to keep the portal tidy.
//
// Attachments go up one at a time rather than in parallel. Each is a multi-
// megabyte POST, and the store pushes every payload through React state on its
// way out; five at once is five copies resident at the same moment.

/**
 * @param store    the record store (create + log + notify)
 * @param payload  the filing record, already shaped by FilingModal
 * @param files    [{ fileName, mimeType, fileType, sizeBytes, fileB64 }]
 * @param subject  { action, subject, detail } — the audit line, in the caller's words
 * @returns        { filing, attached, failed } — or null if the filing itself failed
 */
export async function recordFiling(store, { payload, files = [], audit }) {
  const filing = await store.create('waga_filing', payload)
  // `create` has already rolled its optimistic row back and raised the reason.
  if (!filing) return null

  const attached = []
  const failed = []

  for (const f of files) {
    const saved = await store.create('waga_attachment', {
      filingRecordId: filing.recordId,
      requirementId: payload.requirementId,
      occurrenceId: payload.occurrenceId || '',
      siteId: payload.siteId || '',
      // `title` is one of the fields the API lifts to the top level of the
      // document, so a stored attachment is findable by its own name.
      title: f.fileName,
      fileName: f.fileName,
      mimeType: f.mimeType,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      fileB64: f.fileB64,
      uploadedBy: payload.filedBy,
    })
    if (saved) attached.push(saved)
    else failed.push(f.fileName)
  }

  // The count on the filing row is what every screen reads to decide whether to
  // draw a paperclip, so it has to match what actually saved rather than what
  // was picked. Only corrected when they disagree — the common path is one write.
  if (attached.length !== payload.attachmentCount) {
    await store.update('waga_filing', filing.recordId, {
      ...payload, attachmentCount: attached.length,
    })
  }

  if (audit) {
    const evidence = [
      payload.evidenceRef ? `reference ${payload.evidenceRef}` : '',
      attached.length ? `${attached.length} file${attached.length === 1 ? '' : 's'} attached` : '',
    ].filter(Boolean).join(' · ') || 'no evidence recorded'
    await store.log(audit.action, audit.subject, `${audit.detail} · ${evidence}`, payload.siteId || '')
  }

  if (failed.length) {
    store.notify(
      `Filing recorded, but ${failed.join(', ')} did not attach. Try attaching ${failed.length === 1 ? 'it' : 'them'} again.`,
      'error',
    )
  }

  return { filing, attached, failed }
}

/**
 * Turn a stored attachment row into something the browser will open.
 *
 * An object URL rather than a `data:` URL: Chrome blocks top-level navigation to
 * data URLs, so a PDF opened that way silently does nothing. The caller owns the
 * revoke — the URL has to outlive this function for as long as the viewer is on
 * screen.
 */
export function attachmentUrl(row) {
  if (!row?.fileB64) return null
  const raw = atob(row.fileB64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  const blob = new Blob([bytes], { type: row.mimeType || 'application/octet-stream' })
  return URL.createObjectURL(blob)
}

/** Save an already-built object URL to disk under the file's own name. */
export function downloadUrl(url, fileName) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'evidence'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Every attachment for a filing, from the metadata the bulk load already has. */
export function attachmentsByFiling(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!r.filingRecordId) continue
    const list = m.get(r.filingRecordId) || []
    list.push(r)
    m.set(r.filingRecordId, list)
  }
  return m
}
