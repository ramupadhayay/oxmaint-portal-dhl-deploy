'use client'

// Reading a file the user picked, and getting it back out again.
//
// Two portals hold evidence now — WAGA against a completed compliance
// obligation, this one against a work order a technician finished — and the
// substance is identical: validate, read to base64, store, and later turn the
// base64 back into something a browser will open. Only the markup differs, so
// only the markup is written twice.
//
// The cap is real rather than advisory. A record lives in a single Mongo
// document whose ceiling is 16 MB and base64 costs a third on top of the file,
// so 6 MB is where a photograph stops being evidence and starts being a
// liability. It is checked here for a civil message and again on the server,
// where it is checked against the Content-Length header before the body is
// read — a route handler that parses first has already spent the memory.

export const MAX_FILE_BYTES = 6 * 1024 * 1024
export const MAX_FILES = 5

// What evidence actually looks like: the photograph off a phone, the signed
// form, the filing receipt, the lab result, the spreadsheet behind a summary.
export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.txt,.eml,.msg'

const TYPE_BY_EXT = {
  pdf: 'PDF', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', csv: 'CSV',
  xlsx: 'XLSX', xls: 'XLSX', doc: 'DOC', docx: 'DOC', txt: 'TXT',
  eml: 'EMAIL', msg: 'EMAIL',
}

export const typeOf = (name = '') => {
  const ext = (String(name).split('.').pop() || '').toLowerCase()
  return TYPE_BY_EXT[ext] || (ext ? ext.toUpperCase() : 'FILE')
}

export const prettySize = (bytes) => {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** Read one File into the two halves a record stores: its mime type and raw base64. */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error(`${file.name} could not be read.`))
    r.onload = () => {
      const url = String(r.result || '')
      const comma = url.indexOf(',')
      if (comma < 0) return reject(new Error(`${file.name} could not be read.`))
      resolve({
        fileName: file.name,
        // Some browsers hand back an empty type for .msg and .dwg, so the record
        // keeps the extension's answer as well as the browser's.
        mimeType: file.type || url.slice(5, url.indexOf(';')) || 'application/octet-stream',
        fileType: typeOf(file.name),
        sizeBytes: file.size,
        fileB64: url.slice(comma + 1),
      })
    }
    r.readAsDataURL(file)
  })
}

/**
 * Validate and read a picked FileList.
 *
 * Returns `{ read, problems }`. Anything rejected is named in `problems` rather
 * than dropped quietly — a file somebody believes they attached is worse than
 * one they know they did not.
 */
export async function pickFiles(fileList, alreadyHave = 0) {
  const picked = [...(fileList || [])]
  if (!picked.length) return { read: [], problems: [] }

  const room = Math.max(0, MAX_FILES - alreadyHave)
  const overflow = picked.slice(room)
  const inRoom = picked.slice(0, room)
  const oversize = inRoom.filter((f) => f.size > MAX_FILE_BYTES)
  const usable = inRoom.filter((f) => f.size <= MAX_FILE_BYTES)

  const read = []
  for (const f of usable) read.push(await readFile(f))

  const problems = [
    oversize.length && `${oversize.map((f) => f.name).join(', ')} — over ${prettySize(MAX_FILE_BYTES)}`,
    overflow.length && `${overflow.length} more not added — ${MAX_FILES} files is the limit`,
  ].filter(Boolean)

  return { read, problems }
}

/**
 * Turn a stored attachment row into a URL the browser will open.
 *
 * An object URL rather than a `data:` URL: Chrome blocks top-level navigation to
 * data URLs, so a PDF opened that way silently does nothing. The caller owns the
 * revoke — the URL has to outlive this function for as long as it is on screen.
 */
export function attachmentUrl(row) {
  if (!row?.fileB64) return null
  const raw = atob(row.fileB64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: row.mimeType || 'application/octet-stream' }))
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
