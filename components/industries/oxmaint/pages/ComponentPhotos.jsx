'use client'

import { useMemo, useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { apiUrl } from '@/lib/apiPath'
import {
  CASES, cueKey, featuresFromCues, matchCues,
} from '../lib/componentPhotos'

const STORE = 'oxmaint-component-photo-corrections'
const nativeSelect = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-primary/40'

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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Photos</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Add one or more. Read pulls what is visible, then aligns it to a seeded failure mode.
                This is a reference corpus, not a trained plant model.
              </p>
            </div>
            <Badge variant="outline">Eight modes</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild>
            <label>
              Add photos
              <input
                type="file" accept="image/jpeg,image/png,image/webp" multiple
                className="sr-only"
                onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }}
              />
            </label>
          </Button>
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id} type="button"
                  onClick={() => { setPhotoId(photo.id); setDisposition(null); setSaved(null) }}
                  className={`w-24 shrink-0 overflow-hidden rounded-lg border bg-white text-left ${photo.id === photoId ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'}`}
                >
                  {photo.url
                    ? <img src={photo.url} alt="" className="block h-16 w-full object-cover" />
                    : <span className="block h-16 bg-slate-100" />}
                  <span className="block truncate px-1.5 py-1 text-[11px] text-slate-900">{photo.name}</span>
                </button>
              ))}
            </div>
          )}
          {active && (
            <div className="space-y-3">
              {active.url && (
                <img src={active.url} alt={active.name} className="max-h-60 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
              )}
              <Button variant="secondary" onClick={readActive} disabled={reading || !active.image}>
                {reading ? 'Reading the photo' : 'Read this photo'}
              </Button>
              {active.error && <p className="text-sm text-amber-700">{active.error}</p>}
              {active.note && <p className="text-sm text-slate-900">{active.note}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CASES.map((row) => {
          const on = row.case_id === shownId
          return (
            <button
              key={row.case_id} type="button"
              onClick={() => { setPhotoId(null); setCaseId(row.case_id); setDisposition(null); setSaved(null); setNote('') }}
              className={`min-h-11 rounded-lg border p-3 text-left ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-200 bg-white text-slate-900 hover:bg-accent'}`}
            >
              <span className="block text-sm font-semibold">{row.caption}</span>
              <span className={`mt-0.5 block text-xs ${on ? 'text-primary-foreground/80' : 'text-slate-500'}`}>{row.component}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Visible features</CardTitle>
            <p className="text-sm text-slate-500">
              {usingPhoto ? 'Taken from the photo, then scored against the eight modes.' : 'Caption cues, until a photo is read.'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact k="Color" v={features.color} empty={usingPhoto} />
              <Fact k="Texture" v={features.texture} empty={usingPhoto} />
              <Fact k="Geometry" v={features.geometry} empty={usingPhoto} />
              <Fact k="Wear pattern" v={features.wear_pattern} empty={usingPhoto} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Match</CardTitle>
              {hit.corrected && <Badge variant="secondary">Specialist record</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{hit.mode.failure_mode}</p>
              <p className="mt-0.5 text-xs text-slate-500">{hit.mode.component} · {hit.mode.case_id}</p>
            </div>
            <p className="text-sm text-slate-900"><span className="text-slate-500">Next step. </span>{hit.mode.next_step}</p>
            {hit.corrected && hit.correctionNote && <p className="text-sm text-amber-700">{hit.correctionNote}</p>}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Rejected near-misses</p>
              <ul className="mt-2 space-y-1.5">
                {hit.rejected.map((miss) => (
                  <li key={miss.case_id} className="text-sm text-slate-900">
                    <span className="font-medium">{miss.failure_mode}</span>
                    <span className="text-slate-500"> · {miss.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">RCA record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact k="Caption" v={usingPhoto && active ? active.name : selected.caption} />
            <Fact k="Cues" v={liveCues.join(', ')} />
            <Fact k="Hypothesis" v={hit.mode.failure_mode} />
            <Fact k="Conclusion" v={hit.corrected ? hit.mode.failure_mode : 'Open until a specialist disposes.'} />
            <Fact k="Corrective action" v={hit.mode.next_step} />
          </div>
          <div className="flex flex-wrap gap-2">
            {['accept', 'reject', 'correct'].map((item) => (
              <Button
                key={item} type="button" size="sm"
                variant={disposition === item ? 'default' : 'outline'}
                className="capitalize"
                onClick={() => { setDisposition(item); setSaved(null) }}
              >
                {item}
              </Button>
            ))}
          </div>
          {disposition === 'correct' && (
            <label className="block text-sm text-slate-600">
              Corrected mode
              <select value={toId} onChange={(event) => setToId(event.target.value)} className={`${nativeSelect} mt-1`}>
                {CASES.filter((row) => row.case_id !== shownId).map((row) => (
                  <option key={row.case_id} value={row.case_id}>{row.caption}</option>
                ))}
              </select>
            </label>
          )}
          {(disposition === 'reject' || disposition === 'correct') && (
            <label className="block text-sm text-slate-600">
              Specialist note
              <textarea
                value={note} onChange={(event) => setNote(event.target.value)} rows={3}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          )}
          {disposition && (
            <Button variant="secondary" onClick={saveDisposition}>Save disposition</Button>
          )}
          {saved && <p className="text-sm text-slate-900">{saved}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function Fact({ k, v, empty }) {
  const text = Array.isArray(v) ? (v.length ? v.join(', ') : (empty ? 'None in this photo.' : 'None in the caption.')) : v
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</p>
      <p className="mt-0.5 text-sm text-slate-900">{text}</p>
    </div>
  )
}
