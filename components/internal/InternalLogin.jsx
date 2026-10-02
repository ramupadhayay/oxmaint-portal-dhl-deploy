'use client'

// The staff door.
//
// Deliberately plain, and deliberately not the admin console's glass card. That
// screen is a product surface with a logo and a wordmark on it; this one is an
// internal tool that reports on clients, and dressing it up would make it look
// like something a client is meant to find. No branding, no "forgot password",
// no route back into the app — the only thing here is one credential.
//
// It says out loud that an admin password will not work. Whoever lands here
// with the console's credential in their hands would otherwise try it, fail on
// a message that refuses to explain itself, and assume the page is broken.

import { useEffect, useMemo, useState } from 'react'
import { THEMES, preferredTheme, rememberTheme } from './theme'
import { apiUrl } from '@/lib/apiPath'

export default function InternalLogin() {
  const [mode, setMode] = useState('light')
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [message, setMessage] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)

  const t = THEMES[mode]
  const S = useMemo(() => sheet(t), [t])

  useEffect(() => { setMode(preferredTheme()) }, [])
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = t.bg
    document.documentElement.style.colorScheme = mode
    return () => { document.body.style.background = prev }
  }, [t.bg, mode])

  const flip = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    rememberTheme(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/internal/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      setBad(!res.ok)
      setMessage(data.message || (res.ok ? 'Signed in' : 'Could not sign in'))
      if (res.ok) {
        // Back where they were headed, when they were headed somewhere.
        //
        // Only /internal paths are honoured. An open redirect that takes any
        // `next` would let a crafted link land somebody on another origin the
        // moment they sign in, which is the whole trick behind a phishing hop.
        let next = '/internal'
        try {
          const q = new URLSearchParams(window.location.search).get('next')
          if (q && /^\/internal(\/|$)/.test(q)) next = q
        } catch { /* keep the default */ }
        setTimeout(() => { window.location.href = next }, 300)
      }
    } catch {
      setBad(true)
      setMessage('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  return (
    <div style={S.page}>
      <button onClick={flip} style={S.theme} title={mode === 'dark' ? 'Switch to day' : 'Switch to night'}>
        {mode === 'dark' ? '☀' : '☾'}
      </button>

      <div style={S.card}>
        <div style={S.eyebrow}>
          <span style={S.dot} />
          Internal · staff only
        </div>
        <h1 style={S.h1}>Portal usage</h1>
        <p style={S.sub}>
          Reporting on how clients are using their portals. Cleared accounts only —
          an admin console password does not open this.
        </p>

        <form onSubmit={submit}>
          <label style={S.field}>
            <span style={S.label}>Internal email</span>
            <input
              type="email" name="email" value={form.email} onChange={change}
              autoComplete="username" required autoFocus style={S.input}
            />
          </label>

          <label style={S.field}>
            <span style={S.label}>Password</span>
            <span style={S.pw}>
              <input
                type={showPw ? 'text' : 'password'} name="password" value={form.password}
                onChange={change} autoComplete="current-password" required
                style={{ ...S.input, paddingRight: 62 }}
              />
              {/* type="button" — inside a form, a bare button submits it. */}
              <button type="button" onClick={() => setShowPw((v) => !v)} style={S.eye}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          <button type="submit" disabled={busy} style={{ ...S.go, ...(busy ? S.goBusy : null) }}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>

        {/* Reserved whether or not there is a message, so the card does not
            jump the moment one arrives. */}
        <p style={{ ...S.msg, color: message ? (bad ? t.red : t.green) : 'transparent' }}>
          {message || ' '}
        </p>
      </div>

      <p style={S.legal}>Restricted · this page is not indexed and has no public link</p>
    </div>
  )
}

// Tailwind's preflight is off in this app, so a bare <button> or <input> keeps
// the browser's own chrome. Every control below states its border, background
// and box-sizing rather than trusting a reset that is not there.
const sheet = (t) => ({
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24,
    background: t.bg, color: t.ink, position: 'relative',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  theme: {
    position: 'absolute', top: 18, right: 18, width: 36, height: 36,
    display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer',
    borderRadius: 10, background: t.panel, color: t.sub, fontSize: 15,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },

  card: {
    boxSizing: 'border-box', width: '100%', maxWidth: 400, padding: '28px 30px 22px',
    borderRadius: 16, background: t.panel, boxShadow: t.lift,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: t.red,
  },
  dot: { width: 7, height: 7, borderRadius: '50%', background: t.red, display: 'inline-block' },
  h1: { margin: '12px 0 0', fontSize: 25, fontWeight: 800, letterSpacing: -0.5, color: t.ink },
  sub: { margin: '8px 0 22px', fontSize: 12.5, color: t.sub, lineHeight: 1.65 },

  field: { display: 'block', marginBottom: 14 },
  label: { display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: t.mute, marginBottom: 6 },
  input: {
    boxSizing: 'border-box', width: '100%', padding: '11px 13px', borderRadius: 10,
    background: t.field, color: t.ink, fontFamily: 'inherit', fontSize: 14, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: t.fieldEdge,
  },
  pw: { display: 'block', position: 'relative' },
  eye: {
    position: 'absolute', top: 6, right: 6, padding: '5px 9px', cursor: 'pointer',
    borderRadius: 7, background: 'transparent', color: t.mute,
    fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },

  go: {
    boxSizing: 'border-box', width: '100%', marginTop: 6, padding: '12px 14px', cursor: 'pointer',
    borderRadius: 10, background: t.accent, color: t.bg,
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    borderStyle: 'none', borderWidth: 0,
  },
  goBusy: { opacity: 0.7, cursor: 'wait' },
  msg: { minHeight: 16, margin: '14px 0 0', fontSize: 12, fontWeight: 600 },

  legal: { margin: 0, fontSize: 11, color: t.mute },
})
