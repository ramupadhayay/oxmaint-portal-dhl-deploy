'use client'

// The WAGA portal's own sign-in — the door the client is given.
//
// It borrows the admin console's glass-on-blueprint composition so the two read
// as one product, but it is the portal's front door, not the console's: the
// accent is the portal's teal, the copy names the portal rather than "admin",
// and a success lands inside the portal, never on the console. proxy.js is what
// enforces the gate; this is only the form in front of it.

import { useEffect, useState } from 'react'
import { IBM_Plex_Sans } from 'next/font/google'
import { apiUrl } from '@/lib/apiPath'
import { assetPath } from '@/lib/apiPath'

const plex = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

const THEME_KEY = 'waga-login-theme'

export default function WagaLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Light by default, resolved after mount — localStorage does not exist on the
  // server and a backdrop that differs between renders is a hydration mismatch.
  const [theme, setTheme] = useState('light')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch { /* private mode — light it is */ }
  }, [])
  const flipTheme = () => setTheme((t) => {
    const next = t === 'light' ? 'dark' : 'light'
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    return next
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/portal/waga/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setIsError(!res.ok)
      setMessage(data.message)
      if (res.ok) {
        // Back to wherever the gate sent them from, or the portal's front page.
        // Read from the URL rather than a hook so the page needs no Suspense
        // boundary, and only an in-portal path is honoured — an open redirect is
        // not a feature a sign-in should ship with.
        let next = '/portal/waga/overview'
        try {
          const q = new URLSearchParams(window.location.search).get('next')
          if (q && q.startsWith('/portal/waga')) next = q
        } catch { /* default it is */ }
        setTimeout(() => { window.location.href = next }, 400)
      }
    } catch {
      setIsError(true)
      setMessage('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`wl ${plex.className}`} data-theme={theme} suppressHydrationWarning>
      <style>{CSS}</style>

      <button onClick={flipTheme} className="wl-theme" suppressHydrationWarning
        title={theme === 'light' ? 'Switch to the dark background' : 'Switch to the light background'}
        aria-label="Switch background">
        {theme === 'light' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </button>

      <div className="wl-card">
        <img src={assetPath('/waga/ifactory-logo.png')} alt="" className="wl-mark" aria-hidden="true" />

        <div className="wl-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Energy · Compliance &amp; EHS
        </div>

        <h1 className="wl-title">iFactory AI</h1>
        <p className="wl-sub">Sign in to your compliance portal</p>

        <form onSubmit={handleLogin} suppressHydrationWarning>
          <label className="wl-field">
            <span>Email</span>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              autoComplete="username" required suppressHydrationWarning />
          </label>

          <label className="wl-field">
            <span>Password</span>
            <div className="wl-pw">
              <input type={showPw ? 'text' : 'password'} name="password" value={form.password}
                onChange={handleChange} autoComplete="current-password" required suppressHydrationWarning />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="wl-eye"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                title={showPw ? 'Hide password' : 'Show password'} suppressHydrationWarning>
                {showPw ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-6" />
                    <path d="M9.9 4.2A10.1 10.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2" />
                    <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button type="submit" className="wl-go" disabled={loading} suppressHydrationWarning>
            <span className="wl-go-label">{loading ? 'Signing in' : 'Sign in'}</span>
            {loading ? (
              <span className="wl-spin" aria-hidden="true" />
            ) : (
              <svg className="wl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
              </svg>
            )}
          </button>
        </form>

        <p className={`wl-msg${message ? (isError ? ' bad' : ' ok') : ''}`}>{message || ' '}</p>

        <div className="wl-rule" />
        <p className="wl-foot">Access is granted per user. Contact your iFactory AI representative for an account.</p>
      </div>

      <p className="wl-legal">iFactory AI · Energy Compliance &amp; EHS · Restricted access</p>
    </div>
  )
}

const CSS = `
.wl, .wl * { box-sizing:border-box }

.wl {
  --bg-img:url(${assetPath('/brand/login-bg-light.webp')});
  --bg-flat:#eef4f2;
  --glass:rgba(255,255,255,.55);
  --glass-bd:rgba(255,255,255,.9);
  --glass-hi:rgba(255,255,255,1);
  --ink:#0f2b26; --sub:#33544c; --mute:#2f4c45;
  --field:rgba(255,255,255,.78); --field-bd:rgba(15,43,38,.14);
  --accent:#0f766e; --btn-from:#12897f; --btn-to:#0b5f58;
  --red:#c0392f; --green:#0f766e;
  --shadow:0 24px 60px rgba(13,54,48,.16);
  --autofill:rgba(255,255,255,.96);
  --autofill-ink:#0f2b26;
  --legal:rgba(15,43,38,.88);
  --chip:rgba(15,43,38,.06); --chip-bd:rgba(15,43,38,.12);

  display:flex; flex-direction:column; justify-content:center; align-items:center;
  min-height:100vh; padding:24px; position:relative;
  background:var(--bg-flat) var(--bg-img) center/cover no-repeat;
  color:var(--ink);
}
.wl[data-theme="dark"] {
  --bg-img:url(${assetPath('/brand/login-bg.webp')});
  --bg-flat:#06201d;
  --glass:rgba(255,255,255,.075);
  --glass-bd:rgba(255,255,255,.16);
  --glass-hi:rgba(255,255,255,.42);
  --ink:#eafaf6; --sub:#9ed3c8; --mute:#a9d8ce;
  --field:rgba(255,255,255,.07); --field-bd:rgba(255,255,255,.15);
  --accent:#2dd4bf; --btn-from:#0f9488; --btn-to:#0a635b;
  --red:#ff9a92; --green:#5fd6b2;
  --shadow:0 30px 80px rgba(2,18,16,.55);
  --autofill:rgba(12,48,44,.92);
  --autofill-ink:#eafaf6;
  --legal:rgba(255,255,255,.84);
  --chip:rgba(255,255,255,.09); --chip-bd:rgba(255,255,255,.2);
}
@media (max-width:820px) {
  .wl { --bg-img:url(${assetPath('/brand/login-bg-light-mobile.webp')}) }
  .wl[data-theme="dark"] { --bg-img:url(${assetPath('/brand/login-bg-mobile.webp')}) }
}

.wl-theme {
  position:absolute; top:18px; right:18px; z-index:2;
  width:38px; height:38px; border-radius:11px; padding:0;
  display:grid; place-items:center; cursor:pointer;
  border:1px solid var(--glass-bd); background:var(--glass); color:var(--ink);
  backdrop-filter:blur(18px) saturate(150%);
  -webkit-backdrop-filter:blur(18px) saturate(150%);
  transition:transform .12s, filter .12s;
}
.wl-theme:hover { filter:brightness(1.06) }
.wl-theme:active { transform:scale(.94) }

.wl-card {
  position:relative; width:100%; max-width:420px; min-width:0; padding:32px 34px 26px;
  border-radius:20px; border:1px solid var(--glass-bd);
  background:var(--glass);
  backdrop-filter:blur(30px) saturate(160%);
  -webkit-backdrop-filter:blur(30px) saturate(160%);
  box-shadow:var(--shadow), inset 0 1px 0 rgba(255,255,255,.16);
  animation:wlUp .5s cubic-bezier(.22,1,.36,1) both;
  text-align:center;
}
.wl-card::before {
  content:''; position:absolute; inset:0 0 auto; height:1px; border-radius:20px 20px 0 0;
  background:linear-gradient(90deg,transparent,var(--glass-hi),transparent);
}
@keyframes wlUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
@media (prefers-reduced-motion:reduce) {
  .wl-card, .wl-theme, .wl-arrow, .wl-go::after { animation:none; transition:none }
}

.wl-mark { height:52px; width:auto; display:block; margin:0 auto 14px; object-fit:contain }
.wl[data-theme="dark"] .wl-mark { filter:brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.45)) }

.wl-badge {
  display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
  border-radius:999px; border:1px solid var(--chip-bd);
  background:var(--chip); color:var(--ink);
  font-size:10px; font-weight:600; letter-spacing:.11em; text-transform:uppercase;
}
.wl-title { margin:14px 0 4px; font-size:30px; font-weight:700; letter-spacing:-.03em; line-height:1.1 }
.wl-sub { margin:0 0 26px; font-size:14px; font-weight:400; color:var(--sub) }

.wl-field { display:block; margin-bottom:14px; text-align:left }
.wl-field > span {
  display:block; font-size:11px; font-weight:600; letter-spacing:.04em;
  color:var(--mute); margin-bottom:6px;
}
.wl-field input {
  width:100%; padding:12px 14px; border-radius:11px;
  border:1px solid var(--field-bd); background:var(--field); color:var(--ink);
  font-family:inherit; font-size:14.5px; outline:none;
  transition:border-color .14s, box-shadow .14s, background .14s;
}
.wl-field input:focus {
  border-color:var(--accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 24%, transparent);
}
.wl-field input:-webkit-autofill {
  -webkit-text-fill-color:var(--autofill-ink);
  -webkit-box-shadow:0 0 0 100px var(--autofill) inset;
  caret-color:var(--autofill-ink);
}

.wl-pw { position:relative }
.wl-pw input { padding-right:44px }
.wl-eye {
  position:absolute; top:50%; right:6px; transform:translateY(-50%);
  width:32px; height:32px; padding:0; border:none; background:transparent;
  color:var(--mute); display:grid; place-items:center; cursor:pointer;
  border-radius:8px; transition:color .12s, background .12s;
}
.wl-eye:hover { color:var(--ink); background:var(--chip) }

.wl-go {
  position:relative; overflow:hidden;
  width:100%; min-width:0; margin-top:8px; padding:14px 16px;
  border-radius:12px; border:none;
  background:linear-gradient(180deg, var(--btn-from), var(--btn-to));
  color:#fff; font-family:inherit; font-size:14.5px; font-weight:600; letter-spacing:.01em;
  display:flex; align-items:center; justify-content:center; gap:9px;
  cursor:pointer; box-shadow:0 10px 26px color-mix(in srgb, var(--btn-to) 42%, transparent);
  transition:filter .14s, transform .06s, box-shadow .14s;
}
.wl-go:hover:not(:disabled) { filter:brightness(1.1); box-shadow:0 13px 32px color-mix(in srgb, var(--btn-to) 50%, transparent) }
.wl-go:active:not(:disabled) { transform:translateY(1px) }
.wl-go:disabled { opacity:.75; cursor:wait; box-shadow:none }
.wl-go::after {
  content:''; position:absolute; top:0; bottom:0; left:-60%; width:45%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
  transform:skewX(-18deg); transition:left .5s ease;
}
.wl-go:hover:not(:disabled)::after { left:120% }
.wl-go-label { position:relative }
.wl-arrow { transition:transform .16s ease }
.wl-go:hover:not(:disabled) .wl-arrow { transform:translateX(3px) }

.wl-spin {
  width:15px; height:15px; border-radius:50%;
  border:2px solid rgba(255,255,255,.35); border-top-color:#fff;
  animation:wlSpin .7s linear infinite;
}
@keyframes wlSpin { to { transform:rotate(360deg) } }

.wl-msg { min-height:16px; margin:14px 0 0; font-size:12.5px; font-weight:500; color:transparent }
.wl-msg.bad { color:var(--red) }
.wl-msg.ok { color:var(--green) }

.wl-rule { height:1px; background:var(--chip-bd); margin:18px 0 14px }
.wl-foot { margin:0; font-size:12px; color:var(--sub); line-height:1.5 }

.wl-legal { margin:20px 0 0; font-size:11.5px; color:var(--legal); text-align:center }

@media (max-width:440px) {
  .wl { padding:16px }
  .wl-theme { top:12px; right:12px; width:34px; height:34px }
  .wl-card { padding:26px 22px 20px; border-radius:16px }
  .wl-mark { height:44px }
  .wl-title { font-size:26px }
}
`
