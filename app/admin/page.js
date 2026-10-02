'use client'

// Admin console sign-in.
//
// The card is glass over one of two backgrounds — a light industrial blueprint
// by default, and a dark navy one behind a toggle. Both are composed for it:
// busy at the edges, near-empty through the middle, so the artwork reads around
// the card rather than through the text.
//
// The card cannot simply keep its colours across the two. Glass takes its
// legibility from what is behind it, so the contents invert with the backdrop —
// dark ink on the light one, light on the dark. A single fixed palette would be
// unreadable on one of them, and a white panel would be a white panel: it would
// cover the artwork instead of sitting on it, which is the whole difference
// between glass and a box.
//
// What is gone from the design this came from is the "your session was ended
// elsewhere" notice: it existed because a staff console could kill a live
// session out from under someone, and that console is not part of this app — a
// message about a thing that cannot happen is worse than no message.

import { useEffect, useState } from 'react'
import { IBM_Plex_Sans } from 'next/font/google'
import { apiUrl } from '@/lib/apiPath'
import { assetPath } from '@/lib/apiPath'

// The system stack is nobody's typeface. Plex has actual character, and the
// console's two halves share it so they read as one product.
const plex = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

const THEME_KEY = 'admin-login-theme'

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Light by default. Resolved after mount rather than in the initial state:
  // localStorage does not exist on the server, and a backdrop that differs
  // between the two renders is a hydration mismatch.
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
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setIsError(!res.ok)
      setMessage(data.message)
      if (res.ok) {
        // Back where they were headed, when they were headed somewhere.
        //
        // /api/cmms/enter sends a signed-out admin here with ?next= pointing at
        // itself, because it mints a 60-second CMMS ticket and cannot do that
        // without a cookie. Nothing was reading the parameter, so clicking the
        // CMMS card while signed out landed on the console and the card had to
        // be clicked again.
        //
        // Only /admin and /api/cmms paths are honoured. A `next` that takes any
        // value would let a crafted link land somebody on another origin the
        // moment they sign in, which is the whole trick behind a phishing hop —
        // and the leading-slash-then-word shape also refuses "//evil.example".
        let next = '/admin/portals'
        try {
          const q = new URLSearchParams(window.location.search).get('next')
          if (q && /^\/(admin|api\/cmms)(\/|$)/.test(q)) next = q
        } catch { /* keep the default */ }
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
    <div className={`al ${plex.className}`} data-theme={theme} suppressHydrationWarning>
      <style>{CSS}</style>

      <button onClick={flipTheme} className="al-theme" suppressHydrationWarning
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

      <div className="al-card">
        {/* The bull alone, not the lockup: the wordmark is the heading directly
            beneath it, and printing the name twice reads as unconsidered. */}
        <img src={assetPath('/oxmaint/logo-wb.png')} alt="" className="al-mark" aria-hidden="true" />

        <div className="al-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Admin console
        </div>

        <h1 className="al-title">Oxmaint AI</h1>
        <p className="al-sub">Sign in to administer the portal</p>

        <form onSubmit={handleLogin} suppressHydrationWarning>
          <label className="al-field">
            <span>Admin email</span>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              autoComplete="username" required suppressHydrationWarning />
          </label>

          <label className="al-field">
            <span>Password</span>
            <div className="al-pw">
              <input type={showPw ? 'text' : 'password'} name="password" value={form.password}
                onChange={handleChange} autoComplete="current-password" required suppressHydrationWarning />
              {/* type="button" — inside a form, a bare button submits it. */}
              <button type="button" onClick={() => setShowPw((v) => !v)} className="al-eye"
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

          <button type="submit" className="al-go" disabled={loading} suppressHydrationWarning>
            <span className="al-go-label">{loading ? 'Signing in' : 'Sign in to Admin Console'}</span>
            {loading ? (
              <span className="al-spin" aria-hidden="true" />
            ) : (
              <svg className="al-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
              </svg>
            )}
          </button>
        </form>

        {/* Reserved whether or not there is a message, so the card does not
            jump the moment one arrives. */}
        <p className={`al-msg${message ? (isError ? ' bad' : ' ok') : ''}`}>{message || ' '}</p>

        <div className="al-rule" />
        <p className="al-foot">
          Not an admin? <a href="/portal/oxmaint/dashboard">Open the portal →</a>
        </p>
      </div>

      <p className="al-legal">Oxmaint AI · Admin Console v1.0 · Restricted access</p>
    </div>
  )
}

const CSS = `
/* box-sizing does not inherit, and a card that is content-box adds its
   padding and border on top of width:100% - which is how it ended up
   wider than the screen it was told to fit. */
.al, .al * { box-sizing:border-box }

/* Light is the default: the palette lives on the bare class, and only the
   handful of values that actually differ are restated for dark. Writing both
   themes out in full would be two things to keep in step. */
.al {
  --bg-img:url(${assetPath('/brand/login-bg-light.webp')});
  --bg-flat:#eef2f8;
  --glass:rgba(255,255,255,.55);
  --glass-bd:rgba(255,255,255,.9);
  --glass-hi:rgba(255,255,255,1);
  --ink:#111d3b; --sub:#3a4a68; --mute:#33405a;
  --field:rgba(255,255,255,.78); --field-bd:rgba(17,29,59,.14);
  --accent:#2748c4; --btn-from:#3a5cd6; --btn-to:#22409f;
  --red:#c0392f; --green:#1a7f37;
  --shadow:0 24px 60px rgba(23,42,89,.16);
  --autofill:rgba(255,255,255,.96);
  --autofill-ink:#111d3b;
  --legal:rgba(17,29,59,.88);
  --chip:rgba(17,29,59,.06); --chip-bd:rgba(17,29,59,.12);

  display:flex; flex-direction:column; justify-content:center; align-items:center;
  min-height:100vh; padding:24px; position:relative;
  background:var(--bg-flat) var(--bg-img) center/cover no-repeat;
  color:var(--ink);
}
.al[data-theme="dark"] {
  --bg-img:url(${assetPath('/brand/login-bg.webp')});
  --bg-flat:#0a1a3a;
  --glass:rgba(255,255,255,.075);
  --glass-bd:rgba(255,255,255,.16);
  --glass-hi:rgba(255,255,255,.42);
  --ink:#f2f6fb; --sub:#a9bdd8; --mute:#b3c6de;
  --field:rgba(255,255,255,.07); --field-bd:rgba(255,255,255,.15);
  --accent:#4d84f3; --btn-from:#2b50c2; --btn-to:#14338a;
  --red:#ff9a92; --green:#5fd68a;
  --shadow:0 30px 80px rgba(3,10,28,.55);
  --autofill:rgba(30,48,90,.92);
  --autofill-ink:#f2f6fb;
  --legal:rgba(255,255,255,.84);
  --chip:rgba(255,255,255,.09); --chip-bd:rgba(255,255,255,.2);
}
@media (max-width:820px) {
  .al { --bg-img:url(${assetPath('/brand/login-bg-light-mobile.webp')}) }
  .al[data-theme="dark"] { --bg-img:url(${assetPath('/brand/login-bg-mobile.webp')}) }
}

.al-theme {
  position:absolute; top:18px; right:18px; z-index:2;
  width:38px; height:38px; border-radius:11px; padding:0;
  display:grid; place-items:center; cursor:pointer;
  border:1px solid var(--glass-bd); background:var(--glass); color:var(--ink);
  backdrop-filter:blur(18px) saturate(150%);
  -webkit-backdrop-filter:blur(18px) saturate(150%);
  transition:transform .12s, filter .12s;
}
.al-theme:hover { filter:brightness(1.06) }
.al-theme:active { transform:scale(.94) }

.al-card {
  position:relative; width:100%; max-width:420px; min-width:0; padding:32px 34px 26px;
  border-radius:20px; border:1px solid var(--glass-bd);
  background:var(--glass);
  backdrop-filter:blur(30px) saturate(160%);
  -webkit-backdrop-filter:blur(30px) saturate(160%);
  box-shadow:var(--shadow), inset 0 1px 0 rgba(255,255,255,.16);
  animation:alUp .5s cubic-bezier(.22,1,.36,1) both;
  /* Centred. The mark, badge, heading, button, message and footer all share one
     axis; the fields stay left-aligned, because a label centred over its own
     box stops telling you which box it belongs to. */
  text-align:center;
}
.al-card::before {
  content:''; position:absolute; inset:0 0 auto; height:1px; border-radius:20px 20px 0 0;
  background:linear-gradient(90deg,transparent,var(--glass-hi),transparent);
}
@keyframes alUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
@media (prefers-reduced-motion:reduce) {
  .al-card, .al-theme, .al-arrow, .al-go::after { animation:none; transition:none }
}

/* The mark is navy, and on the dark backdrop navy-on-navy disappears. There is
   no reversed version of this file, so it is lifted rather than recoloured: a
   drop-shadow gives it an edge to sit against without touching the artwork. */
.al-mark { height:52px; width:auto; display:block; margin:0 auto 14px; object-fit:contain }
.al[data-theme="dark"] .al-mark { filter:brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.45)) }

.al-badge {
  display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
  border-radius:999px; border:1px solid var(--chip-bd);
  background:var(--chip); color:var(--ink);
  font-size:10px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
}
.al-title { margin:14px 0 4px; font-size:30px; font-weight:700; letter-spacing:-.03em; line-height:1.1 }
.al-sub { margin:0 0 26px; font-size:14px; font-weight:400; color:var(--sub) }

.al-field { display:block; margin-bottom:14px; text-align:left }
.al-field > span {
  display:block; font-size:11px; font-weight:600; letter-spacing:.04em;
  color:var(--mute); margin-bottom:6px;
}
.al-field input {
  width:100%; padding:12px 14px; border-radius:11px;
  border:1px solid var(--field-bd); background:var(--field); color:var(--ink);
  font-family:inherit; font-size:14.5px; outline:none;
  transition:border-color .14s, box-shadow .14s, background .14s;
}
.al-field input:focus {
  border-color:var(--accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 24%, transparent);
}
/* Chrome paints its own opaque block over autofilled fields, which puts a
   solid rectangle in the middle of the glass. The inset shadow repaints it,
   in whichever direction the current backdrop needs. */
.al-field input:-webkit-autofill {
  -webkit-text-fill-color:var(--autofill-ink);
  -webkit-box-shadow:0 0 0 100px var(--autofill) inset;
  caret-color:var(--autofill-ink);
}

.al-pw { position:relative }
.al-pw input { padding-right:44px }
.al-eye {
  position:absolute; top:50%; right:6px; transform:translateY(-50%);
  width:32px; height:32px; padding:0; border:none; background:transparent;
  color:var(--mute); display:grid; place-items:center; cursor:pointer;
  border-radius:8px; transition:color .12s, background .12s;
}
.al-eye:hover { color:var(--ink); background:var(--chip) }

.al-go {
  position:relative; overflow:hidden;
  width:100%; min-width:0; margin-top:8px; padding:14px 16px;
  border-radius:12px; border:none;
  background:linear-gradient(180deg, var(--btn-from), var(--btn-to));
  color:#fff; font-family:inherit; font-size:14.5px; font-weight:600; letter-spacing:.01em;
  display:flex; align-items:center; justify-content:center; gap:9px;
  cursor:pointer; box-shadow:0 10px 26px color-mix(in srgb, var(--btn-to) 42%, transparent);
  transition:filter .14s, transform .06s, box-shadow .14s;
}
.al-go:hover:not(:disabled) { filter:brightness(1.1); box-shadow:0 13px 32px color-mix(in srgb, var(--btn-to) 50%, transparent) }
.al-go:active:not(:disabled) { transform:translateY(1px) }
.al-go:disabled { opacity:.75; cursor:wait; box-shadow:none }
/* A sheen that crosses once on hover — it says the control is live without
   moving anything the eye then has to re-find. */
.al-go::after {
  content:''; position:absolute; top:0; bottom:0; left:-60%; width:45%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
  transform:skewX(-18deg); transition:left .5s ease;
}
.al-go:hover:not(:disabled)::after { left:120% }
.al-go-label { position:relative }
.al-arrow { transition:transform .16s ease }
.al-go:hover:not(:disabled) .al-arrow { transform:translateX(3px) }

.al-spin {
  width:15px; height:15px; border-radius:50%;
  border:2px solid rgba(255,255,255,.35); border-top-color:#fff;
  animation:alSpin .7s linear infinite;
}
@keyframes alSpin { to { transform:rotate(360deg) } }

.al-msg { min-height:16px; margin:14px 0 0; font-size:12.5px; font-weight:500; color:transparent }
.al-msg.bad { color:var(--red) }
.al-msg.ok { color:var(--green) }

.al-rule { height:1px; background:var(--chip-bd); margin:18px 0 14px }
.al-foot { margin:0; font-size:12.5px; color:var(--sub) }
.al-foot a { color:var(--ink); font-weight:600; text-decoration:none }
.al-foot a:hover { text-decoration:underline }

.al-legal { margin:20px 0 0; font-size:11.5px; color:var(--legal); text-align:center }

@media (max-width:440px) {
  .al { padding:16px }
  .al-theme { top:12px; right:12px; width:34px; height:34px }
  .al-card { padding:26px 22px 20px; border-radius:16px }
  .al-mark { height:44px }
  .al-title { font-size:26px }
}
`
