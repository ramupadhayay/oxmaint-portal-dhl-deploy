'use client'

// Per-screen help. A "?" button sits in the corner of every screen in the
// portal; opening it shows the manual for THAT screen and nothing else.
//
// The panel answers the four questions in the order somebody asks them — what
// is this for, what am I looking at, what do I do, where do I go next — and
// walks the screenshots as a flow rather than showing one still: the register,
// then the dialog it opens, then what the dialog records. A single picture of a
// screen a user is already looking at teaches nothing; the sequence is the part
// that does.
//
// "Next step" is a link, not a sentence. Reading that you should go to the
// calendar next and then having to find it in the sidebar is a manual failing
// at the one moment it was useful, so each one navigates.
//
// Content lives in lib/help.js, keyed by section. The screenshots are captured
// against the running portal, so a caption cannot describe a control that is no
// longer there without the capture failing first.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { helpFor, HELP, HELP_ORDER } from '../lib/help'
import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE
const SHOTS = '/waga/help/'

/* ── PDF ──────────────────────────────────────────────────────────────────── */

// A screenshot as a data URL plus its natural size, so the PDF can scale it
// without guessing the aspect ratio.
async function loadShot(file) {
  const res = await fetch(SHOTS + file)
  if (!res.ok) throw new Error('missing ' + file)
  const blob = await res.blob()
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  return { dataUrl, w: img.width, h: img.height }
}

const M = 46
const HEAD_BASE = 50 // baseline of the running header
const BODY_TOP = 88 // first body line on a continuation page
const FOOT = 60 // room kept clear for the footer

const TEAL = [15, 118, 110]
const DEEP = [15, 23, 42]
const BODY = [51, 65, 85]
const SOFT = [110, 125, 140]
const RULE = [214, 226, 224]
const WASH = [240, 253, 250]

const CONTACT = 'contact@ifactoryapp.com'

// jsPDF's built-in fonts speak CP1252 and nothing else. A character outside it
// is not dropped, it is drawn as whatever byte it collides with and the widths
// go with it — which is how `Use "Full calendar →"` reached the page as
// `Use "Full calendar !"` in stretched letters. The screen keeps its arrow; the
// document gets an ASCII one. Everything drawn goes through here.
const CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ'
  + '‘’“”•–—˜™š›œžŸ'

const T = (s) => String(s)
  .replace(/[→⇒➡➔➜]/g, '->')
  .replace(/[←⇐]/g, '<-')
  .replace(/↑/g, '^').replace(/↓/g, 'v')
  .replace(/ /g, ' ')
  .split('')
  .filter((c) => c.charCodeAt(0) <= 0xFF || CP1252.includes(c))
  .join('')

/**
 * One document, with one set of rules about where things sit.
 *
 * Everything draws through this rather than moving a `y` by hand, because the
 * hand-rolled version got all three of the ways that goes wrong: a heading
 * could land at the foot of a page with its own list overleaf, a numbered
 * step's digit could sit on a different page from the sentence it belongs to,
 * and every screenshot claimed a fresh page and left two thirds of it white.
 *
 * `room(h)` is what fixes all three — a block asks for the height it needs
 * before it draws a single line of itself.
 */
function makeDoc(jsPDF, runningTitle) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const ctx = { doc, W, H, y: BODY_TOP, title: runningTitle, width: W - M * 2 }

  // The product's name rides the top of every page. A page printed or
  // photocopied out of the manual should still say whose product it is.
  ctx.header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEAL)
    doc.text('iFactory AI', M, HEAD_BASE)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...SOFT)
    doc.text(doc.splitTextToSize(T(ctx.title), ctx.width - 120)[0], W - M, HEAD_BASE, { align: 'right' })
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
    doc.line(M, HEAD_BASE + 11, W - M, HEAD_BASE + 11)
  }
  ctx.page = () => { doc.addPage(); ctx.header(); ctx.y = BODY_TOP }
  ctx.room = (h) => { if (ctx.y + h > H - FOOT) ctx.page() }
  return ctx
}

function para(ctx, text, { size = 10.5, color = BODY, font = 'normal', indent = 0, gap = 14.5, after = 0 } = {}) {
  const { doc } = ctx
  doc.setFont('helvetica', font); doc.setFontSize(size); doc.setTextColor(...color)
  for (const ln of doc.splitTextToSize(T(text), ctx.width - indent)) {
    ctx.room(gap)
    doc.text(ln, M + indent, ctx.y)
    ctx.y += gap
  }
  ctx.y += after
}

// A heading claims room for itself and for whatever must follow it, so it can
// never be left stranded as the last thing on a page. `need` is the height of
// the first block underneath — a screenshot is 300pt tall, and a heading that
// only reserved its own two lines would sit at the foot of a page with three
// hundred points of white under it and the picture overleaf.
function heading(ctx, label, need = 20) {
  ctx.room(30 + need)
  ctx.y += 10
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.5); ctx.doc.setTextColor(...TEAL)
  ctx.doc.text(T(label).toUpperCase(), M, ctx.y)
  ctx.y += 15
}

function bullets(ctx, items, gap = 13.6) {
  for (const it of items) {
    const lines = ctx.doc.splitTextToSize(T(it), ctx.width - 15)
    ctx.room(lines.length * gap + 4)
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(10); ctx.doc.setTextColor(...TEAL)
    ctx.doc.text('•', M + 2, ctx.y)
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setTextColor(...BODY)
    lines.forEach((ln, i) => ctx.doc.text(ln, M + 15, ctx.y + i * gap))
    ctx.y += lines.length * gap + 4
  }
}

function numbered(ctx, items, gap = 13.6) {
  items.forEach((s, i) => {
    const lines = ctx.doc.splitTextToSize(T(s), ctx.width - 23)
    ctx.room(lines.length * gap + 6) // the digit and its first line stay together
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(10); ctx.doc.setTextColor(...TEAL)
    ctx.doc.text(`${i + 1}.`, M, ctx.y)
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setTextColor(...BODY)
    lines.forEach((ln, n) => ctx.doc.text(ln, M + 23, ctx.y + n * gap))
    ctx.y += lines.length * gap + 6
  })
}

// The screenshots flow one after another and break only when the next one will
// not fit. On A4 two land per page; giving each its own page — which is what
// this used to do — left half of every one of them blank.
async function shots(ctx, list) {
  if (!list?.length) return

  // Loaded before the heading is drawn, so the heading can reserve the height of
  // the first picture and travel to the next page with it rather than without.
  const loaded = []
  for (const shot of list) {
    try { loaded.push({ shot, img: await loadShot(shot.file) }) } catch { /* a missing frame costs one frame */ }
  }
  if (!loaded.length) return

  const blockOf = ({ shot, img }) => {
    const w = Math.min(ctx.width, 462)
    const cap = ctx.doc.splitTextToSize(T(shot.caption), w)
    return w * (img.h / img.w) + 13 + cap.length * 12.5 + 11
  }
  heading(ctx, 'The screen, step by step', blockOf(loaded[0]))

  for (const { shot, img } of loaded) {
    // Held under the text width on purpose, and the exact number matters. A
    // 1380x860 capture drawn at the full 503pt column stands 313pt tall; two of
    // those with their captions come to 704pt against 694pt of usable page, so
    // every second screenshot would take a page of its own and leave the one
    // before it two thirds white. At 462pt the picture is 288pt tall and the
    // section heading plus BOTH screenshots land on one page (689pt), which is
    // what keeps the manual from doubling in length.
    const w = Math.min(ctx.width, 462)
    const x = M + (ctx.width - w) / 2
    const h = w * (img.h / img.w)
    const cap = ctx.doc.splitTextToSize(T(shot.caption), w)
    ctx.room(h + 12 + cap.length * 12.5 + 14)
    ctx.doc.addImage(img.dataUrl, 'JPEG', x, ctx.y, w, h)
    ctx.doc.setDrawColor(...RULE); ctx.doc.setLineWidth(0.7)
    ctx.doc.rect(x, ctx.y, w, h)
    ctx.y += h + 13
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(9); ctx.doc.setTextColor(...SOFT)
    cap.forEach((ln) => { ctx.doc.text(ln, x, ctx.y); ctx.y += 12.5 })
    ctx.y += 11
  }
}

// `titled: false` for the single-screen guide, whose opening block has already
// set the name in 22pt — printing it again immediately underneath was the
// duplicate heading on page one.
function sectionText(ctx, help, { titled = true } = {}) {
  ctx.title = `${help.title} · WAGA Energy portal`
  if (titled) {
    ctx.room(56)
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(18); ctx.doc.setTextColor(...DEEP)
    for (const ln of ctx.doc.splitTextToSize(T(help.title), ctx.width)) { ctx.doc.text(ln, M, ctx.y); ctx.y += 22 }
    ctx.y += 3
  }

  para(ctx, help.purpose, { size: 10.8, gap: 14.8, after: 2 })
  heading(ctx, 'What you are looking at')
  bullets(ctx, help.reads)
  heading(ctx, 'What you do here')
  numbered(ctx, help.steps)
  if (help.tips?.length) { heading(ctx, 'Good to know'); bullets(ctx, help.tips) }
  if (help.next?.length) {
    heading(ctx, 'Where to go next')
    bullets(ctx, help.next.map((n) => `${n.label} — ${n.why}`))
  }
}

async function renderSection(ctx, help, opts) {
  sectionText(ctx, help, opts)
  await shots(ctx, help.shots)
}

// Who to write to. Last page of the manual, and the foot of a single-screen
// guide, because that is where somebody looks once they have read it and still
// have a question.
function contactBlock(ctx, { ownPage = false } = {}) {
  if (ownPage) {
    ctx.title = 'Company & contact'
    ctx.page()
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(18); ctx.doc.setTextColor(...DEEP)
    ctx.doc.text('Company & contact', M, ctx.y); ctx.y += 26
    para(ctx, 'This portal is built and delivered by iFactory AI. The compliance and EHS '
      + 'trial it covers is run for WAGA Energy across its two trial sites, and the data in it '
      + 'is illustrative until the live import is signed off.', { gap: 14.8, after: 6 })
  } else {
    ctx.room(120)
    ctx.y += 6
  }

  const rows = [
    ['Product', 'iFactory AI — Compliance & EHS portal'],
    ['Client', 'WAGA Energy'],
    ['Contact', CONTACT],
  ]
  const bh = 26 * rows.length + 22
  ctx.room(bh)
  ctx.doc.setFillColor(...WASH); ctx.doc.setDrawColor(...RULE); ctx.doc.setLineWidth(0.7)
  ctx.doc.roundedRect(M, ctx.y, ctx.width, bh, 8, 8, 'FD')
  let ry = ctx.y + 24
  for (const [k, v] of rows) {
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(9); ctx.doc.setTextColor(...SOFT)
    ctx.doc.text(k, M + 16, ry)
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(10.5); ctx.doc.setTextColor(...DEEP)
    ctx.doc.text(v, M + 92, ry)
    ry += 26
  }
  ctx.y += bh + 12
  para(ctx, `Questions about this manual, or about anything in the portal it does not answer, go to ${CONTACT}.`,
    { size: 9.5, color: SOFT, gap: 13 })
}

function footer(ctx, label, firstNumbered = 1) {
  const { doc, W, H } = ctx
  const n = doc.internal.getNumberOfPages()
  const total = n - firstNumbered + 1
  for (let p = firstNumbered; p <= n; p += 1) {
    doc.setPage(p)
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
    doc.line(M, H - 40, W - M, H - 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...SOFT)
    doc.text(`${label}  ·  ${CONTACT}`, M, H - 27)
    doc.text(`${p - firstNumbered + 1} of ${total}`, W - M, H - 27, { align: 'right' })
  }
}

// The opening of a single-screen guide: branded, but not a whole cover page for
// what is often only two sides of paper.
function titleBlock(ctx, kicker, title) {
  const { doc, W } = ctx
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEAL)
  doc.text('iFactory AI', M, 54)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SOFT)
  doc.text(kicker, W - M, 54, { align: 'right' })
  doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
  doc.line(M, 66, W - M, 66)
  ctx.y = 96
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...DEEP)
  for (const ln of doc.splitTextToSize(T(title), ctx.width)) { doc.text(ln, M, ctx.y); ctx.y += 26 }
  ctx.y += 8
}

async function downloadOne(help) {
  const { jsPDF } = await import('jspdf')
  const ctx = makeDoc(jsPDF, `${help.title} · WAGA Energy portal`)
  titleBlock(ctx, 'WAGA Energy · Compliance & EHS', help.title)
  // Text, then the contact box, then the screenshots. The screenshots cannot
  // start until a whole one fits, so the text page ends with a quarter of itself
  // white — and "who do I ask" is exactly the thing worth putting in that gap
  // rather than leaving it, or pushing it to a page of its own at the back.
  sectionText(ctx, help, { titled: false })
  contactBlock(ctx)
  await shots(ctx, help.shots)
  footer(ctx, `iFactory AI — ${help.title}`)
  ctx.doc.save(`iFactory-AI-${help.title.replace(/[^\w]+/g, '-')}.pdf`)
}

async function downloadAll() {
  const { jsPDF } = await import('jspdf')
  const ctx = makeDoc(jsPDF, 'WAGA Energy — Compliance & EHS portal')
  const { doc, W, H } = ctx

  // Cover.
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, H, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(255, 255, 255)
  doc.text('iFactory AI', M, 200)
  doc.setDrawColor(125, 211, 197); doc.setLineWidth(1)
  doc.line(M, 222, M + 150, 222)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(167, 243, 224)
  doc.text('COMPLIANCE & EHS PORTAL', M, 250)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(31); doc.setTextColor(255, 255, 255)
  doc.text('User Manual', M, 300)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(199, 240, 233)
  doc.text('WAGA Energy', M, 330)
  doc.setFontSize(11)
  doc.splitTextToSize('Every screen of the portal: what it is for, what you are looking at, what you '
    + 'do there, and where you go next — with the screens themselves, step by step.', ctx.width - 90)
    .forEach((ln, i) => doc.text(ln, M, 372 + i * 17))
  doc.setFontSize(9.5); doc.setTextColor(167, 243, 224)
  doc.text(CONTACT, M, H - 60)

  // Contents.
  ctx.title = 'Contents'
  ctx.page()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...DEEP)
  doc.text('Contents', M, ctx.y); ctx.y += 28
  HELP_ORDER.forEach((key, i) => {
    const h = HELP[key]
    if (!h) return
    ctx.room(21)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TEAL)
    doc.text(String(i + 1).padStart(2, '0'), M, ctx.y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...BODY)
    doc.text(h.title, M + 26, ctx.y)
    doc.setFontSize(9); doc.setTextColor(...SOFT)
    doc.text(doc.splitTextToSize(h.purpose, ctx.width - 200)[0], M + 190, ctx.y)
    ctx.y += 21
  })

  for (const key of HELP_ORDER) {
    const h = HELP[key]
    if (!h) continue
    ctx.title = `${h.title} · WAGA Energy portal`
    ctx.page()
    await renderSection(ctx, h)
  }

  contactBlock(ctx, { ownPage: true })
  footer(ctx, 'iFactory AI — WAGA Energy Compliance & EHS portal', 2)
  doc.save('iFactory-AI-WAGA-Energy-Portal-User-Manual.pdf')
}

/* ── the panel ────────────────────────────────────────────────────────────── */

export default function HelpButton({ section }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [imgOk, setImgOk] = useState(true)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [labelUp, setLabelUp] = useState(true)
  const [hover, setHover] = useState(false)
  const help = helpFor(section)
  const shots = help.shots || []

  // Reset the flow whenever the screen — or the panel — changes, so opening
  // help on a new screen never starts halfway through the previous one's flow.
  useEffect(() => { setI(0); setImgOk(true) }, [section, open])

  // The label breathes — five seconds up, five down — so the control keeps
  // offering itself instead of becoming furniture nobody sees by the second day.
  // It holds still while the panel is open, while the pointer is on it (a label
  // that vanishes as you reach for it is worse than no label), and for anyone
  // who has asked their system for reduced motion.
  useEffect(() => {
    let reduced = false
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* older browser */ }
    if (open || hover || reduced) { setLabelUp(true); return undefined }
    const id = setInterval(() => setLabelUp((v) => !v), 5000)
    return () => clearInterval(id)
  }, [open, hover])

  const step = useCallback((d) => setI((n) => (shots.length ? (n + d + shots.length) % shots.length : 0)), [shots.length])

  // "?" opens it from anywhere, Esc closes, arrows walk the flow. Ignored while
  // someone is typing — a help panel that springs open mid-form is a bug.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (typing) return
      if (!open && (e.key === '?' || (e.key === '/' && e.shiftKey))) { e.preventDefault(); setOpen(true); return }
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  // A download that fails has to say so. Swallowing it leaves a button that
  // looks like it worked and a person waiting for a file that is never coming.
  const run = async (what, fn) => {
    setBusy(what); setErr('')
    try { await fn() } catch (e) { setErr(e?.message || 'The document could not be prepared.') } finally { setBusy('') }
  }

  const goNext = (key) => { setOpen(false); router.push(`/portal/waga/${key}`) }

  return (
    <>
      {/* The label is its own control beside the button rather than inside it, so
          it can come and go on its own while the "?" stays put — a button that
          changed width every five seconds would drag the corner of the page
          around with it. Both open the same panel. */}
      <div style={S.dock} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <button onClick={() => setOpen(true)} tabIndex={labelUp ? 0 : -1} aria-hidden={!labelUp}
          style={{ ...S.label, ...(labelUp ? S.labelIn : S.labelOut) }}>
          Need help with this screen?
        </button>
        <button onClick={() => setOpen(true)} title={`Help · ${help.title}  (press ?)`} aria-label="Help for this screen"
          style={S.orb}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><line x1="12" y1="17.5" x2="12" y2="17.5" />
          </svg>
        </button>
      </div>

      {open && (
        <div style={S.scrim} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={`Help — ${help.title}`}>
          <div style={S.panel} onClick={(e) => e.stopPropagation()}>
            <div style={S.head}>
              <span style={S.mark}>?</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={S.kicker}>Help · this screen</span>
                <span style={S.title}>{help.title}</span>
              </span>
              <button onClick={() => setOpen(false)} title="Close  (Esc)" aria-label="Close" style={S.x}>×</button>
            </div>

            <div style={S.body}>
              <p style={S.purpose}>{help.purpose}</p>

              {/* the flow */}
              {imgOk && shots.length > 0 && (
                <div style={S.flow}>
                  <div style={S.frame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SHOTS + shots[i].file} alt={shots[i].caption} onError={() => setImgOk(false)} style={S.img} />
                    {shots.length > 1 && (
                      <>
                        <button onClick={() => step(-1)} aria-label="Previous step" style={{ ...S.arrow, left: 8 }}>‹</button>
                        <button onClick={() => step(1)} aria-label="Next step" style={{ ...S.arrow, right: 8 }}>›</button>
                      </>
                    )}
                    <span style={S.count}>{i + 1} / {shots.length}</span>
                  </div>
                  <div style={S.caption}>{shots[i].caption}</div>
                  {shots.length > 1 && (
                    <div style={S.dots}>
                      {shots.map((s, n) => (
                        <button key={s.file} onClick={() => setI(n)} title={s.caption} aria-label={`Step ${n + 1}`}
                          style={{ ...S.dot, background: n === i ? ACCENT : '#cbd5e1', width: n === i ? 18 : 7 }} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={S.h}>What you are looking at</div>
              <ul style={S.ul}>
                {help.reads.map((r, n) => <li key={n} style={S.li}><span style={S.bullet} />{r}</li>)}
              </ul>

              <div style={S.h}>What you do here</div>
              <ol style={S.ol}>
                {help.steps.map((s, n) => (
                  <li key={n} style={S.step}><span style={S.num}>{n + 1}</span><span style={S.stepText}>{s}</span></li>
                ))}
              </ol>

              {help.tips?.length ? (
                <div style={S.tips}>
                  <div style={S.tipsH}>Good to know</div>
                  {help.tips.map((t, n) => <div key={n} style={S.tip}><span style={{ color: ACCENT }}>•</span><span>{t}</span></div>)}
                </div>
              ) : null}

              {help.next?.length ? (
                <>
                  <div style={S.h}>Where to go next</div>
                  <div style={S.nexts}>
                    {help.next.map((n) => (
                      <button key={n.section} onClick={() => goNext(n.section)} style={S.next} title={`Open ${n.label}`}>
                        <span style={S.nextLabel}>{n.label} <span style={S.nextArrow}>→</span></span>
                        <span style={S.nextWhy}>{n.why}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <div style={S.actions}>
                <button onClick={() => run('one', () => downloadOne(help))} disabled={Boolean(busy)} style={S.primary}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  {busy === 'one' ? 'Preparing…' : 'This screen (PDF)'}
                </button>
                <button onClick={() => run('all', downloadAll)} disabled={Boolean(busy)} style={S.ghost}>
                  {busy === 'all' ? 'Building the manual…' : 'Full manual (PDF)'}
                </button>
                <button onClick={() => setOpen(false)} style={S.ghost}>Close</button>
              </div>
              {err ? <p style={S.err} role="alert">{err}</p> : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const S = {
  dock: { position: 'fixed', right: 20, bottom: 20, zIndex: 3900, display: 'flex', alignItems: 'center', gap: 10 },

  // Frosted rather than opaque: these sit over the page for good, and a solid
  // pill would blank out a strip of whatever is under it. The tint is the
  // portal's own green, so it reads as part of the product rather than as
  // browser furniture.
  label: {
    padding: '10px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12.5, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap', letterSpacing: '.01em',
    background: 'rgba(209,250,238,0.42)',
    backdropFilter: 'blur(12px) saturate(170%)', WebkitBackdropFilter: 'blur(12px) saturate(170%)',
    border: '1px solid rgba(15,118,110,0.28)',
    boxShadow: '0 6px 22px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.62)',
    transition: 'opacity .45s ease, transform .45s cubic-bezier(.22,1,.36,1)',
  },
  labelIn: { opacity: 1, transform: 'none', pointerEvents: 'auto' },
  labelOut: { opacity: 0, transform: 'translateX(14px) scale(.96)', pointerEvents: 'none' },

  orb: {
    width: 46, height: 46, borderRadius: '50%', padding: 0, cursor: 'pointer', flexShrink: 0,
    display: 'grid', placeItems: 'center', color: ACCENT,
    background: 'rgba(236,253,247,0.62)',
    backdropFilter: 'blur(12px) saturate(170%)', WebkitBackdropFilter: 'blur(12px) saturate(170%)',
    border: '1px solid rgba(15,118,110,0.34)',
    boxShadow: '0 6px 22px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.7)',
    transition: 'transform .15s',
  },
  scrim: {
    position: 'fixed', inset: 0, zIndex: 4100, background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  panel: {
    width: 'min(680px, 96vw)', maxHeight: '88vh', overflowY: 'auto',
    background: '#fff', borderRadius: 16, border: `1px solid ${LINE}`,
    boxShadow: '0 30px 80px -20px rgba(2,6,23,0.5)',
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '17px 20px', borderBottom: `1px solid ${LINE}`, position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0', zIndex: 1 },
  mark: { width: 38, height: 38, borderRadius: 11, background: '#ecfdf5', color: ACCENT, display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, fontSize: 17 },
  kicker: { display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTE },
  title: { display: 'block', fontSize: 17.5, fontWeight: 800, color: INK, lineHeight: 1.25 },
  x: { background: 'none', border: 'none', cursor: 'pointer', color: MUTE, fontSize: 22, lineHeight: 1, padding: 4 },
  body: { padding: '15px 20px 20px' },
  purpose: { margin: '0 0 14px', fontSize: 13.5, color: SUB, lineHeight: 1.6 },

  flow: { margin: '0 0 18px' },
  frame: { position: 'relative', border: `1px solid ${LINE}`, borderRadius: 11, overflow: 'hidden', background: '#f8fafc', boxShadow: '0 4px 14px -6px rgba(15,23,42,0.25)' },
  img: { display: 'block', width: '100%', height: 'auto' },
  // Glass rather than a solid disc: these sit on top of the screenshot, and an
  // opaque button hides the very part of the screen the caption is pointing at.
  // Tinted the portal's green so it still reads as a control against a mostly
  // white screenshot.
  arrow: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 30, height: 30, borderRadius: '50%', padding: 0,
    background: 'rgba(209,250,238,0.42)',
    backdropFilter: 'blur(7px) saturate(150%)', WebkitBackdropFilter: 'blur(7px) saturate(150%)',
    border: '1px solid rgba(15,118,110,0.32)', color: ACCENT,
    fontSize: 17, lineHeight: 1, cursor: 'pointer', display: 'grid', placeItems: 'center',
    boxShadow: '0 2px 10px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.55)',
  },
  count: { position: 'absolute', top: 8, right: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(15,23,42,0.62)', color: '#fff', fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  caption: { marginTop: 9, fontSize: 12, color: SUB, lineHeight: 1.5 },
  dots: { display: 'flex', gap: 5, marginTop: 9, alignItems: 'center' },
  dot: { height: 7, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', transition: 'width .15s, background .15s' },

  h: { fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTE, margin: '16px 0 9px' },
  ul: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 },
  li: { display: 'flex', gap: 9, fontSize: 12.8, color: INK, lineHeight: 1.55 },
  bullet: { flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: ACCENT, marginTop: 7 },
  ol: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 },
  step: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  num: { flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: ACCENT, color: '#fff', fontWeight: 800, fontSize: 11.5, display: 'grid', placeItems: 'center', fontFamily: 'ui-monospace, monospace' },
  stepText: { fontSize: 12.8, color: INK, lineHeight: 1.55, paddingTop: 2 },

  tips: { marginTop: 16, padding: '11px 13px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 5 },
  tipsH: { fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#0f766e' },
  tip: { fontSize: 12.3, color: '#115e59', lineHeight: 1.5, display: 'flex', gap: 7 },

  nexts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8 },
  next: { textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  nextLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: ACCENT },
  nextArrow: { fontWeight: 800 },
  nextWhy: { display: 'block', fontSize: 11.5, color: SUB, marginTop: 2, lineHeight: 1.45 },

  actions: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  primary: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, padding: '9px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', color: '#fff', background: ACCENT, fontFamily: 'inherit' },
  ghost: { fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 9, border: `1px solid ${LINE}`, cursor: 'pointer', color: SUB, background: '#fff', fontFamily: 'inherit' },
  err: { margin: '10px 0 0', fontSize: 12, color: '#b91c1c', lineHeight: 1.5 },
}
