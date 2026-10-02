'use client'

// The masthead every PDF this portal produces wears.
//
// A document that leaves the building — a job card carried into a cleanroom, an
// evidence package handed to an inspector — is the product's only representative
// in a room nobody from here is in. An unbranded A4 sheet of tables reads as a
// spreadsheet export; the same sheet with the mark on it reads as a system.
//
// The logo is the real asset from /public rather than a redrawn approximation,
// fetched once and cached for the session. If the fetch fails the wordmark is
// drawn on its own and the document still builds — a missing image is not a
// reason to refuse somebody their job card.

import { assetPath } from '@/lib/apiPath'

const LOGO_URL = assetPath('/oxmaint/logo-white.png')

let cached = null

/** The mark as a data URL, or null if it could not be loaded. */
export async function loadMark() {
  if (cached !== null) return cached
  try {
    const res = await fetch(LOGO_URL)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    cached = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    cached = false
  }
  return cached || null
}

/**
 * Draw the masthead and return the y the content should start at.
 *
 * One band across the top: the mark, the wordmark, then the document's own
 * title and subtitle, with the organisation and the timestamp right-aligned
 * opposite. Everything else on the page hangs off the y this returns, so a
 * change here does not require every caller to re-measure.
 *
 * @param doc    jsPDF instance
 * @param mark   data URL from loadMark(), or null
 * @param opts   { title, subtitle, org, right, width, accent }
 */
export function masthead(doc, mark, {
  title, subtitle, org, right, width = 595.28, margin = 44,
  accent = [21, 34, 122], height = 82,
} = {}) {
  doc.setFillColor(...accent)
  doc.rect(0, 0, width, height, 'F')

  let x = margin

  // The mark, on a white tile so a navy bull is not navy-on-navy. logo-white is
  // the reversed asset, so it goes straight on the band.
  if (mark) {
    try {
      doc.addImage(mark, 'PNG', x, 16, 26, 26)
      x += 34
    } catch {
      // An image jsPDF cannot decode is not worth failing the document over.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(255)
  doc.text('Oxmaint', x, 30)
  const w = doc.getTextWidth('Oxmaint')
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 200, 235)
  doc.text(' AI', x + w, 30)

  // A hairline under the wordmark, the width of the lockup, so the title below
  // reads as a second level rather than a second wordmark.
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.6)
  doc.line(x, 37, x + w + 16, 37)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(255)
  doc.text(clean(title || ''), margin, 62)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(198, 206, 236)
    doc.text(clean(subtitle), margin, 74)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(215, 221, 244)
  if (org) doc.text(clean(org), width - margin, 30, { align: 'right' })
  if (right) doc.text(clean(right), width - margin, 44, { align: 'right' })

  doc.setTextColor(0)
  return height + 26
}

/** The footer, matching. Returns nothing; callers place it at the page bottom. */
export function pageFooter(doc, { width, height, margin = 44, left, page }) {
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.6)
  doc.line(margin, height - 36, width - margin, height - 36)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(21, 34, 122)
  doc.text('Oxmaint AI', margin, height - 24)
  const w = doc.getTextWidth('Oxmaint AI')

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150)
  doc.text(clean(` · ${left}`), margin + w, height - 24)
  doc.text(`Page ${page}`, width - margin, height - 24, { align: 'right' })
  doc.setTextColor(0)
}

// jsPDF's standard fonts are Latin-1 only and this data carries en dashes,
// middots and curly quotes. Left alone they come out as mojibake, which reads
// as a broken export rather than a font limitation.
export const clean = (s) => String(s ?? '')
  .replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/·/g, '-')
  .replace(/[…]/g, '...')
