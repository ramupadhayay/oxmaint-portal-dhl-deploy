// PDF export for the portal.
//
// Drawn, not screenshotted. Rendering the page to canvas and pasting the image
// gives a document you cannot select text in, that reflows to nothing, and that
// carries the sidebar and the chat launcher into a report someone files. Laying
// it out properly costs more here and produces something a facility manager can
// actually keep.
//
// jsPDF's standard fonts are Latin-1 only. The portal's copy is full of em
// dashes and degree signs, and an unsanitised string does not fail loudly — it
// silently switches the whole document to UTF-16 and comes out as mojibake. So
// every string goes through `txt()` on the way in.

const A4_PORTRAIT = { w: 595.28, h: 841.89 }
const A4_LANDSCAPE = { w: 841.89, h: 595.28 }
const M = 42                    // page margin
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]
const GREEN = [4, 120, 87]
const AMBER = [180, 83, 9]
const RED = [185, 28, 28]

export const TONE = { ok: GREEN, warn: AMBER, bad: RED, ink: INK, sub: SUB, mute: MUTE, accent: ACCENT }

// Replace what the standard fonts cannot draw, rather than dropping it — a
// missing dash reads as a typo, a hyphen reads as a dash.
export const txt = (v) => String(v ?? '')
  .replace(/[—–]/g, '-')
  .replace(/[’‘]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/·/g, '-')
  .replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/°/g, ' deg')
  .replace(/[^\x00-\xFF]/g, '')

/**
 * A small drawing surface over jsPDF.
 *
 * Everything here exists because it was needed twice: the header on every
 * document, the page break that no caller should have to remember, and the
 * table, which is the only thing these reports are really made of.
 */
export async function newDoc({ title, subtitle, meta = [], brand = 'Oxmaint', orientation = 'portrait' }) {
  const { jsPDF } = await import('jspdf')
  // Landscape for reports whose tables are wider than they are long. Ten columns
  // on portrait A4 leaves each one about 36pt, which is narrower than a site
  // code — the value wraps mid-word and the table stops being readable. Portrait
  // stays the default so nothing that did not ask for this changes.
  const landscape = orientation === 'landscape'
  const A4 = landscape ? A4_LANDSCAPE : A4_PORTRAIT
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' })
  let y = 0
  let page = 1

  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2])
  const setInk = (c) => doc.setTextColor(c[0], c[1], c[2])
  const setStroke = (c) => doc.setDrawColor(c[0], c[1], c[2])

  const footer = () => {
    setInk(MUTE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(txt(`${title} - generated ${new Date().toLocaleString('en-US')}`), M, A4.h - 24)
    doc.text(String(page), A4.w - M, A4.h - 24, { align: 'right' })
  }

  const header = () => {
    setFill(ACCENT)
    doc.rect(0, 0, A4.w, 62, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(txt(title), M, 30)
    if (subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(214, 220, 245)
      doc.text(txt(subtitle), M, 46)
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    // Whose document this is. Defaulted so the CMMS and data-centre portals are
    // unchanged, and passed by any portal that hands the file to its own client
    // — a WAGA compliance report with another product's name on it is a report
    // its reader has to explain.
    doc.text(txt(brand), A4.w - M, 30, { align: 'right' })
    y = 88
  }

  const api = {
    doc,
    get y() { return y },
    set y(v) { y = v },

    /** Break to a new page when `need` points would run off this one. */
    room(need = 18) {
      if (y + need < A4.h - 46) return
      footer()
      doc.addPage()
      page += 1
      header()
    },

    gap(n = 10) { y += n },

    heading(text) {
      api.room(30)
      setInk(INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11.5)
      doc.text(txt(text), M, y)
      y += 6
      setStroke(LINE)
      doc.setLineWidth(0.7)
      doc.line(M, y, A4.w - M, y)
      y += 15
    },

    para(text, color = SUB) {
      const lines = doc.splitTextToSize(txt(text), A4.w - M * 2)
      api.room(lines.length * 12 + 4)
      setInk(color)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(lines, M, y)
      y += lines.length * 12 + 4
    },

    /** The KPI row every report opens with. */
    stats(items) {
      const per = (A4.w - M * 2) / items.length
      api.room(54)
      items.forEach((s, i) => {
        const x = M + per * i
        setStroke(LINE)
        doc.setLineWidth(0.7)
        doc.roundedRect(x + 2, y, per - 4, 44, 4, 4, 'S')
        setInk(MUTE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.text(txt(String(s.label).toUpperCase()), x + 10, y + 15)
        setInk(s.tone || INK)
        doc.setFontSize(14)
        doc.text(txt(s.value), x + 10, y + 34)
      })
      y += 58
    },

    /**
     * A table. `cols` is `[{ header, width, align, tone }]` where width is a
     * share of the content width, not points — so a column list stays readable
     * and the table always fills the page.
     */
    table(cols, rows, { zebra = true } = {}) {
      const total = cols.reduce((n, c) => n + (c.width || 1), 0)
      const avail = A4.w - M * 2
      const xs = []
      let acc = M
      cols.forEach((c) => { xs.push(acc); acc += ((c.width || 1) / total) * avail })

      // Headers wrap like cells do.
      //
      // They used to be drawn as one line each, so three long labels at the end
      // of a wide table printed on top of one another — "RENEWAL DUE", "STATE"
      // and "OBLIGATIONS" came out as a single unreadable run. A header is the
      // one row a reader has to be able to trust, so it gets the same
      // splitTextToSize treatment the body already had, and the band grows to
      // fit the tallest of them.
      const head = () => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        const wrapped = cols.map((c) => {
          const w = ((c.width || 1) / total) * avail - 12
          return doc.splitTextToSize(txt(String(c.header).toUpperCase()), Math.max(w, 12))
        })
        const lines = Math.max(...wrapped.map((l) => l.length))
        const band = 8 + lines * 9

        api.room(band + 8)
        setFill([248, 250, 252])
        doc.rect(M, y - 11, avail, band, 'F')
        setInk(SUB)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        cols.forEach((c, i) => {
          const w = ((c.width || 1) / total) * avail
          doc.text(wrapped[i],
            c.align === 'right' ? xs[i] + w - 6 : xs[i] + 6, y + 1,
            { align: c.align === 'right' ? 'right' : 'left' })
        })
        y += band - 4
      }

      head()
      rows.forEach((r, ri) => {
        const cells = cols.map((c) => txt(c.value ? c.value(r) : r[c.key]))
        const wrapped = cells.map((v, i) => {
          const w = ((cols[i].width || 1) / total) * avail - 12
          return doc.splitTextToSize(v, w)
        })
        const h = Math.max(...wrapped.map((w) => w.length)) * 10 + 6

        if (y + h > A4.h - 46) {
          footer()
          doc.addPage('a4', landscape ? 'landscape' : 'portrait')
          page += 1
          header()
          head()
        }

        if (zebra && ri % 2 === 1) {
          setFill([252, 253, 254])
          doc.rect(M, y - 8, avail, h, 'F')
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        cols.forEach((c, i) => {
          const w = ((c.width || 1) / total) * avail
          setInk(c.tone ? c.tone(r) : INK)
          doc.text(wrapped[i],
            c.align === 'right' ? xs[i] + w - 6 : xs[i] + 6, y,
            { align: c.align === 'right' ? 'right' : 'left' })
        })
        y += h
        setStroke(LINE)
        doc.setLineWidth(0.4)
        doc.line(M, y - 7, A4.w - M, y - 7)
      })
      y += 8
    },

    /** Label/value pairs, two to a row. */
    fields(pairs) {
      const half = (A4.w - M * 2) / 2
      pairs.forEach(([k, v], i) => {
        if (i % 2 === 0) api.room(26)
        const x = M + (i % 2) * half
        setInk(MUTE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.text(txt(String(k).toUpperCase()), x, y)
        setInk(INK)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(txt(v), x, y + 12)
        if (i % 2 === 1 || i === pairs.length - 1) y += 28
      })
    },

    /** The sign-off block. A report nobody signed is a report nobody owns. */
    signature(by, role) {
      api.room(70)
      y += 12
      setStroke(LINE)
      doc.setLineWidth(0.7)
      doc.line(M, y + 26, M + 190, y + 26)
      doc.line(A4.w - M - 190, y + 26, A4.w - M, y + 26)
      setInk(MUTE)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(txt(`${by}${role ? ` - ${role}` : ''}`), M, y + 38)
      doc.text('Reviewed by', A4.w - M - 190, y + 38)
      y += 50
    },

    save(filename) {
      footer()
      doc.save(filename)
    },

    /** Stamp the last-page footer without triggering a browser download. */
    end() {
      footer()
      return doc
    },
  }

  header()
  if (meta.length) {
    api.fields(meta)
    api.gap(4)
  }
  return api
}
