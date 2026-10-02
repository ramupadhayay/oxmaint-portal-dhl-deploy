'use client'

import { useMemo, useState } from 'react'
import { Section, PALETTE } from '../lib/kit'
import { apiUrl } from '@/lib/apiPath'
import {
  CASES, cueKey, featuresFromCues, matchCues,
} from '../lib/componentPhotos'

const { INK, SUB, MUTE, LINE } = PALETTE
const STORE = 'oxmaint-component-photo-corrections'

function loadCorrections() {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toJpeg(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('unreadable'))
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const data = canvas.toDataURL('image/jpeg', 0.72).split(',')[1] || ''
      if (!data) reject(new Error('empty'))
      else resolve(data)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    image.src = url
  })
}

export default function ComponentPhotos() {
  const [photos, setPhotos] = useState([])
  const [photoId, setPhotoId] = useState(null)
  const [caseId, setCaseId] = useState(CASES[0].case_id)
  const [reading, setReading] = useState(false)
  const [corrections, setCorrections] = useState(loadCorrections)
  const [disposition, setDisposition] = useState(null)
  const [note, setNote] = useState('')
  const [toId, setToId] = useState('BRG-ELEC-01')
  const [saved, setSaved] = useState(null)

  const active = photos.find((photo) => photo.id === photoId) || null
  const selected = CASES.find((row) => row.case_id === caseId) || CASES[0]
  const liveCues = active?.cues?.length ? active.cues : selected.visual_cues
  const usingPhoto = Boolean(active?.cues?.length)
  const features = useMemo(
    () => (usingPhoto && active?.features ? active.features : featuresFromCues(liveCues)),
    [usingPhoto, active, liveCues],
  )
  const hit = useMemo(() => matchCues(liveCues, corrections), [liveCues, corrections])
  const shownId = usingPhoto ? hit.mode.case_id : selected.case_id

  async function addPhotos(list) {
    if (!list?.length) return
    const next = []
    for (const file of Array.from(list).slice(0, 8)) {
      if (!file.type.startsWith('image/')) continue
      try {
        next.push({
          id: `${file.name}-${file.size}-${next.length}`,
          name: file.name,
          url: URL.createObjectURL(file),
          image: await toJpeg(file),
          cues: null,
          features: null,
          note: null,
          error: null,
        })
      } catch {
        next.push({ id: `${file.name}-bad`, name: file.name, url: '', image: '', cues: null, features: null, note: null, error: 'That file could not be read.' })
      }
    }
    setPhotos((current) => [...current, ...next].slice(-8))
    if (next[0]) setPhotoId(next[0].id)
  }

  async function readActive() {
    if (!active?.image || reading) return
    setReading(true)
    setSaved(null)
    try {
      const res = await fetch(apiUrl('/api/oxmaint/component-photo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: active.image }),
      })
      const result = await res.json()
      setPhotos((current) => current.map((photo) => (
        photo.id !== active.id ? photo : result.ok
          ? { ...photo, cues: result.cues, features: result.features, note: result.note, error: null }
          : { ...photo, error: result.error || 'The photo could not be read.' }
      )))
    } catch {
      setPhotos((current) => current.map((photo) => (
        photo.id === active.id ? { ...photo, error: 'The photo could not be read. Try again.' } : photo
      )))
    } finally {
      setReading(false)
    }
  }

  function store(next) {
    const all = [...corrections.filter((row) => row.cueKey !== next.cueKey), next]
    setCorrections(all)
    localStorage.setItem(STORE, JSON.stringify(all))
    setSaved(next.disposition === 'correct'
      ? 'Stored. The next match for these cues reads the corrected mode.'
      : 'Stored on the RCA record. The seed match is unchanged.')
    setDisposition(null)
    setNote('')
  }

  function saveDisposition() {
    const fromId = usingPhoto ? hit.mode.case_id : selected.case_id
    if (disposition === 'accept') {
      store({ cueKey: cueKey(liveCues), from_case_id: fromId, to_case_id: hit.mode.case_id, note: 'Specialist accepted the mode.', disposition: 'accept' })
      return
    }
    if (!note.trim()) return
    if (disposition === 'reject') {
      store({ cueKey: cueKey(liveCues), from_case_id: fromId, to_case_id: hit.mode.case_id, note: note.trim(), disposition: 'reject' })
      return
    }
    if (disposition === 'correct' && toId !== hit.mode.case_id) {
      store({ cueKey: cueKey(liveCues), from_case_id: fromId, to_case_id: toId, note: note.trim(), disposition: 'correct' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="Photos" right={<span style={{ fontSize: 11.5, color: MUTE }}>scored only against these eight modes</span>}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: SUB, lineHeight: 1.45 }}>
          Add one or more. Read pulls what is visible, then aligns it to a seeded failure mode.
          This is a reference corpus, not a trained plant model.
        </p>
        <label style={{
          display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 14px', borderRadius: 9,
          background: '#15227a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Add photos
          <input
            type="file" accept="image/jpeg,image/png,image/webp" multiple
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
            onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }}
          />
        </label>
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12 }}>
            {photos.map((photo) => (
              <button
                key={photo.id} type="button"
                onClick={() => { setPhotoId(photo.id); setDisposition(null); setSaved(null) }}
                style={{
                  width: 96, flex: '0 0 auto', padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${photo.id === photoId ? '#15227a' : LINE}`, background: '#fff',
                }}
              >
                {photo.url ? <img src={photo.url} alt="" style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} /> : <span style={{ display: 'block', height: 64, background: '#f8fafc' }} />}
                <span style={{ display: 'block', padding: '4px 6px', fontSize: 11, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.name}</span>
              </button>
            ))}
          </div>
        )}
        {active && (
          <div style={{ marginTop: 12 }}>
            {active.url && (
              <img src={active.url} alt={active.name} style={{ maxHeight: 240, width: '100%', objectFit: 'contain', borderRadius: 10, border: `1px solid ${LINE}`, background: '#f8fafc' }} />
            )}
            <button
              type="button" onClick={readActive} disabled={reading || !active.image}
              style={{
                marginTop: 10, height: 36, padding: '0 14px', borderRadius: 9, border: 0, cursor: 'pointer',
                background: '#b45309', color: '#fff', fontSize: 13, fontWeight: 600, opacity: reading ? 0.6 : 1,
              }}
            >
              {reading ? 'Reading the photo' : 'Read this photo'}
            </button>
            {active.error && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#b45309' }}>{active.error}</p>}
            {active.note && <p style={{ margin: '8px 0 0', fontSize: 13, color: INK }}>{active.note}</p>}
          </div>
        )}
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
        {CASES.map((row) => {
          const on = row.case_id === shownId
          return (
            <button
              key={row.case_id} type="button"
              onClick={() => { setPhotoId(null); setCaseId(row.case_id); setDisposition(null); setSaved(null); setNote('') }}
              style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 9, cursor: 'pointer', minHeight: 44,
                border: `1px solid ${on ? '#15227a' : LINE}`,
                background: on ? '#15227a' : '#fff',
                color: on ? '#fff' : INK,
              }}
            >
              <span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{row.caption}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: on ? '#dbe4ff' : MUTE }}>{row.component}</span>
            </button>
          )
        })}
      </div>

      <Section title="Visible features">
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: MUTE }}>
          {usingPhoto ? 'Taken from the photo, then scored against the eight modes.' : 'Caption cues, until a photo is read.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, fontSize: 13 }}>
          <Fact k="Color" v={features.color} empty={usingPhoto} />
          <Fact k="Texture" v={features.texture} empty={usingPhoto} />
          <Fact k="Geometry" v={features.geometry} empty={usingPhoto} />
          <Fact k="Wear pattern" v={features.wear_pattern} empty={usingPhoto} />
        </div>
      </Section>

      <Section title="Match">
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{hit.mode.failure_mode}</div>
        <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
          {hit.mode.component} · {hit.mode.case_id}{hit.corrected ? ' · specialist record' : ''}
        </div>
        <p style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}><span style={{ color: MUTE }}>Next step. </span>{hit.mode.next_step}</p>
        {hit.corrected && hit.correctionNote && <p style={{ fontSize: 13, color: '#b45309' }}>{hit.correctionNote}</p>}
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>Rejected near-misses</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {hit.rejected.map((miss) => (
            <li key={miss.case_id} style={{ fontSize: 13, color: INK, marginBottom: 4 }}>
              <strong>{miss.failure_mode}</strong>
              <span style={{ color: MUTE }}> · {miss.why}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="RCA record">
        <Fact k="Caption" v={usingPhoto && active ? active.name : selected.caption} />
        <Fact k="Cues" v={liveCues.join(', ')} />
        <Fact k="Hypothesis" v={hit.mode.failure_mode} />
        <Fact k="Conclusion" v={hit.corrected ? hit.mode.failure_mode : 'Open until a specialist disposes.'} />
        <Fact k="Corrective action" v={hit.mode.next_step} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {['accept', 'reject', 'correct'].map((item) => (
            <button
              key={item} type="button"
              onClick={() => { setDisposition(item); setSaved(null) }}
              style={{
                height: 36, padding: '0 12px', borderRadius: 9, cursor: 'pointer', textTransform: 'capitalize', fontSize: 13,
                border: `1px solid ${disposition === item ? '#15227a' : LINE}`,
                background: disposition === item ? '#15227a' : '#fff',
                color: disposition === item ? '#fff' : INK,
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {disposition === 'correct' && (
          <label style={{ display: 'block', marginTop: 10, fontSize: 13, color: SUB }}>
            Corrected mode
            <select value={toId} onChange={(event) => setToId(event.target.value)} style={{ display: 'block', marginTop: 4, height: 36, width: '100%', borderRadius: 9, border: `1px solid ${LINE}`, padding: '0 8px' }}>
              {CASES.filter((row) => row.case_id !== shownId).map((row) => (
                <option key={row.case_id} value={row.case_id}>{row.caption}</option>
              ))}
            </select>
          </label>
        )}
        {(disposition === 'reject' || disposition === 'correct') && (
          <label style={{ display: 'block', marginTop: 10, fontSize: 13, color: SUB }}>
            Specialist note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} style={{ display: 'block', marginTop: 4, width: '100%', borderRadius: 9, border: `1px solid ${LINE}`, padding: 8 }} />
          </label>
        )}
        {disposition && (
          <button type="button" onClick={saveDisposition} style={{ marginTop: 10, height: 36, padding: '0 14px', borderRadius: 9, border: 0, background: '#b45309', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Save disposition
          </button>
        )}
        {saved && <p style={{ fontSize: 13, color: INK }}>{saved}</p>}
      </Section>
    </div>
  )
}

function Fact({ k, v, empty }) {
  const text = Array.isArray(v) ? (v.length ? v.join(', ') : (empty ? 'None in this photo.' : 'None in the caption.')) : v
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10.5, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.3 }}>{k}</div>
      <div style={{ fontSize: 13, color: INK, lineHeight: 1.4 }}>{text}</div>
    </div>
  )
}
