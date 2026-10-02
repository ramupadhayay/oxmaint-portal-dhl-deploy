'use client'

// Evidence held against a work order.
//
// The product's technician screen ends a job with "Upload Proof", and its work
// order detail carries an Attachments tab. This portal had the tab and nothing
// that could ever fill it, so the tab said "no attachments" whatever anyone did.
//
// Files go up one at a time rather than in parallel: each is a multi-megabyte
// POST and the store pushes every payload through React state on its way out,
// so five at once is five copies resident at the same moment. A file that fails
// is named rather than swallowed, and the ones that succeeded stay — losing four
// good photographs because the fifth was too large helps nobody.
//
// The bytes never ride the bulk record load. `data.fileB64` is projected away
// by BLOB_FIELDS in app/api/oxmaint/records/route.js, so the rows still arrive —
// which is what lets a work order say "3 files" without fetching any of them —
// and a payload is fetched by id only when somebody opens one.

export const ATTACHMENT_KIND = 'attachment'

/**
 * @param create  the store's create(kind, data)
 * @param files   what EvidenceUpload produced
 * @param meta    { work_order_id, work_order_number, title, uploadedBy }
 * @returns       { attached, failed }
 */
export async function saveAttachments(create, files, meta) {
  const attached = []
  const failed = []

  for (const f of files) {
    const saved = await create(ATTACHMENT_KIND, {
      work_order_id: meta.work_order_id,
      work_order_number: meta.work_order_number || '',
      // `title` is one of the fields the API lifts to the top of the document,
      // so a stored attachment is findable by its own name.
      title: f.fileName,
      subject: meta.title || '',
      fileName: f.fileName,
      mimeType: f.mimeType,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      fileB64: f.fileB64,
      uploadedBy: meta.uploadedBy || '',
      uploadedAt: new Date().toISOString(),
    })
    if (saved) attached.push(saved)
    else failed.push(f.fileName)
  }

  return { attached, failed }
}

/** Every attachment, grouped by the work order it belongs to. */
export function attachmentsByWorkOrder(rows) {
  const m = new Map()
  for (const r of rows || []) {
    if (!r.work_order_id) continue
    const list = m.get(r.work_order_id) || []
    list.push(r)
    m.set(r.work_order_id, list)
  }
  return m
}
