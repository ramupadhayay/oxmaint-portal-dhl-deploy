'use client'

// CSV export, once.
//
// Eight screens across this repo hand-roll the same eight lines, and the copies
// have already drifted — some quote, some do not, none writes a BOM. This is the
// one WAGA uses, and it takes the same `[{ header, value(row) }]` column array
// the reports and the PDF read, so an exported file has exactly the columns that
// were on screen.
//
// Two details that matter for a file a client opens in Excel:
//
//  * The BOM. Without it Excel reads the file as the machine's ANSI codepage and
//    an em dash or a middle dot in a header comes out as garbage. It is three
//    bytes and it is the difference between a report you can send and one you
//    have to explain.
//  * CRLF. Excel accepts LF, but other tools in a compliance chain do not, and
//    RFC 4180 says CRLF.
//
// Nothing here goes through the PDF text sanitiser. That exists because jsPDF's
// standard fonts are Latin-1; a UTF-8 CSV has no such limit, and stripping
// characters out of an export would lose data rather than render it.

const cell = (v) => {
  const s = v == null ? '' : String(v)
  // A leading =, +, - or @ is executed by Excel as a formula. Prefixing a
  // single quote keeps the value readable and inert. Only reached by text the
  // client typed — a note, an evidence reference — which is exactly the text an
  // attacker would control.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * @param filename  what the browser saves it as
 * @param columns   [{ header, value(row) }] — the same array the table renders
 * @param rows      the rows, already filtered and sorted the way they appear
 * @param preamble  optional [[label, value]] pairs written above the header, so
 *                  a file leaving the portal carries its own scope and basis
 */
export function exportCsv(filename, columns, rows, preamble = []) {
  const lines = []

  for (const [label, value] of preamble) lines.push([cell(label), cell(value)].join(','))
  if (preamble.length) lines.push('')

  lines.push(columns.map((c) => cell(c.header)).join(','))
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(','))

  const csv = `﻿${lines.join('\r\n')}\r\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Given a tick before revoking: the click is synchronous but the browser
  // reads the URL on a later frame.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** A filename that will not need renaming: lower case, no spaces, no slashes. */
export const slug = (s) => String(s || 'report')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'report'
