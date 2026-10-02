'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { SPEC, UNITS } from '../lib/humanoid/quality'
import { apiUrl } from '@/lib/apiPath'

function StepList({ steps }) {
  if (!steps?.length) return null
  return (
    <ol className="space-y-2">
      {steps.map((row, index) => (
        <li key={`${row.label}-${index}`} className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">{index + 1}. {row.label}</p>
          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-slate-700">{JSON.stringify(row.publish, null, 2)}</pre>
        </li>
      ))}
    </ol>
  )
}

export default function HumanoidQa() {
  const [active, setActive] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function judge(body) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/humanoid/qa'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) {
        setError(data.error || 'The station could not judge that.')
        return
      }
      setResult(data)
      setActive(data.unit_id || 'PHOTO')
    } catch {
      setError('The station could not judge that.')
    } finally {
      setBusy(false)
    }
  }

  function onPhoto(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      judge({ image: value })
    }
    reader.readAsDataURL(file)
  }

  return (
    <HumanoidGate title="Quality inspection">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{SPEC.product}</CardTitle>
            <Badge variant="outline">{SPEC.id}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {SPEC.fill_ml} ml · {SPEC.sku} · {SPEC.station}. The robot photographs each carton.
            A pass stays on the belt. A fail is a jaw pick into {SPEC.reject_bin}.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SPEC.checks.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{row.name}</p>
              <p className="text-xs text-slate-500">{row.pass}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Station frames</CardTitle>
          <p className="text-sm text-slate-500">What the head camera already has. Synthetic frames, not a live filler.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {UNITS.map((unit) => (
            <div key={unit.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{unit.id}</p>
                {active === unit.id && result && (
                  <Badge variant={result.pass ? 'secondary' : 'outline'}>{result.pass ? 'Pass' : 'Fail'}</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{unit.frame}</p>
              <Button className="mt-2" size="sm" variant="secondary" disabled={busy} onClick={() => judge({ unit_id: unit.id })}>
                Photograph and judge
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Or send a photo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button asChild variant="outline" disabled={busy}>
            <label>
              Upload a carton photo
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </Button>
          {error && <p className="text-sm text-slate-700">{error}</p>}
          {result && (
            <div className="space-y-3">
              <p className="text-sm text-slate-900">
                {result.unit_id} · {result.pass ? 'Meets the spec. Stays on the line.' : `Fails ${result.failed.map((row) => row.name).join(', ')}. ${result.disposition}.`}
              </p>
              <StepList steps={result.steps} />
            </div>
          )}
        </CardContent>
      </Card>
    </HumanoidGate>
  )
}
