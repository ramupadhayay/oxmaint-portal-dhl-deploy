'use client'

// The team directory — the WAGA people who work this compliance trial.
//
// Modelled on the CMMS portal's Team Management screen so all the portals in
// this deployment read the same: a roster of who has access, grouped by the
// department they sit in, with a way to add someone.
//
// It began as a directory only — name, work email, department — and said a
// login was issued "in a separate step". There was no step. Nothing in the
// portal could create a credential, so anybody the client added sat on
// "Login pending" with no way out of it, on a screen that told the admin they
// were the one who issues logins. Adding a person now issues the login too,
// and the roster has a button for the people already stranded there.
//
// A member can still add somebody to the roster and cannot issue anything —
// that is the admin's act, checked on the server from their own account rather
// than from anything this screen sends.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Section, DataTable, Toolbar, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Note } from '../components/cells'
import { useStore, useRecords, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { TEAM, DEPARTMENTS } from '../lib/data'
import { handoverPdf, CONTACT } from '../lib/handoverPdf'
import { MIN_PASSWORD_LENGTH, suggestPassword } from '@/lib/wagaPassword'
import { apiUrl } from '@/lib/apiPath'

const idOf = (m) => m.userId || m.recordId

// The one <option> that is not a department. Deliberately something nobody
// would ever name a department, so it cannot collide with a real one.
const NEW_DEPT = '__new-department__'

export default function Team() {
  const store = useStore()
  const members = useRecords('waga_member', TEAM, idOf)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)

  // Login accounts come from the User collection, not the roster store. The
  // signed-in person's own role decides whether any password comes back — an
  // admin sees them, a member does not.
  const [info, setInfo] = useState({ isAdmin: false, me: null, byEmail: {} })
  const [revealed, setRevealed] = useState({})
  const [packing, setPacking] = useState('')
  // Whose login is being issued right now, and what came back — the password is
  // shown once in a modal as well as landing on the roster, because an admin who
  // clicks this is about to tell somebody their password.
  const [issuing, setIssuing] = useState('')
  const [issued, setIssued] = useState(null)
  const [changingPw, setChangingPw] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch(apiUrl('/api/portal/waga/users'))
      if (!r.ok) return
      const d = await r.json()
      const byEmail = {}
      for (const u of d.users || []) byEmail[String(u.email || '').toLowerCase()] = u
      setInfo({ isAdmin: Boolean(d.isAdmin), me: d.me || null, byEmail })
    } catch { /* the roster still renders without login status */ }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])
  const loginOf = (m) => info.byEmail[String(m.email || '').toLowerCase()] || null

  /**
   * Issue a portal login for somebody already on the roster.
   *
   * Returns what the server said so the caller can decide whether to show it —
   * adding a person shows one combined message, the roster button shows its own.
   */
  const issueLogin = async ({ name, email, department, password }) => {
    setIssuing(String(email || '').toLowerCase())
    try {
      const r = await fetch(apiUrl('/api/portal/waga/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No password from the roster button — the server generates one there.
        // The Add form sends what the admin actually saw on screen.
        body: JSON.stringify({ name, email, department, ...(password ? { password } : {}) }),
      })
      const d = await r.json().catch(() => ({}))
      // Reload either way: a 409 means somebody else already issued it, and the
      // roster should stop saying "pending".
      await loadUsers()
      return { ok: r.ok, ...d }
    } catch {
      return { ok: false, message: 'Could not reach the server.' }
    } finally {
      setIssuing('')
    }
  }

  const departments = useMemo(
    () => [...new Set(members.map((m) => m.department).filter(Boolean))].sort(),
    [members],
  )

  // What the Add form offers.
  //
  // The workbook's own departments first, so the list is complete even before
  // anybody from one of them is on the roster, then anything the portal has
  // added since. The filter above deliberately stays on `departments` — a
  // filter for a department with nobody in it filters to nothing.
  const deptOptions = useMemo(
    () => [...new Set([...DEPARTMENTS, ...departments].filter(Boolean))].sort(),
    [departments],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => (
      (department === 'all' || m.department === department) &&
      (!q || [m.name, m.email, m.department].join(' ').toLowerCase().includes(q))
    ))
  }, [members, search, department])

  const open = members.find((m) => idOf(m) === openId) || null

  // Only an admin can reach the form that calls this — a member gets the card
  // telling them who to ask — so there is no roster-only path left. Adding
  // somebody and issuing their login are one action now: the half-done state
  // the roster used to show, with a person on it and no way in, was the bug.
  const addMember = async ({ password, ...payload }) => {
    const saved = await store.create('waga_member', payload)
    if (!saved) return
    await store.log('Team member added', `${payload.name} · ${payload.department}`, payload.email)
    setAdding(false)

    const res = await issueLogin({ ...payload, password })
    if (res.ok) {
      setIssued({ ...payload, ...res })
      store.notify(`${payload.name} added, and their login is ready.`)
    } else {
      // The person is on the roster; only the credential failed. Say which, so
      // nobody re-adds them chasing a password.
      store.notify(res.message || 'Added to the roster, but the login could not be issued.', 'error')
    }
  }

  return (
    <div>
      <PageHeading
        title="Team"
        subtitle={`The WAGA Energy people with access to this compliance trial, across ${departments.length} department${departments.length === 1 ? '' : 's'}.`}
        right={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {/* Everyone signed in can change their own password. Only their own:
                the server takes the account from the cookie, so this button
                cannot be pointed at somebody else. */}
            {info.me && (
              <ActionButton variant="ghost" onClick={() => setChangingPw(true)}>Change my password</ActionButton>
            )}
            {/* Administrator only, and for the same reason the password column
                is: the pack it builds carries every live credential. */}
            {info.isAdmin && (
              <ActionButton variant="ghost" disabled={Boolean(packing)} onClick={async () => {
                setPacking('pack')
                try {
                  await handoverPdf({
                    members,
                    byEmail: info.byEmail,
                    signInUrl: `${window.location.origin}/portal/waga/login`,
                  })
                } catch (e) {
                  setPacking('')
                  store.notify(e?.message || 'The handover pack could not be prepared.', 'error')
                  return
                }
                setPacking('')
              }}>
                {packing ? 'Preparing…' : 'Handover pack (PDF)'}
              </ActionButton>
            )}
            <ActionButton onClick={() => setAdding(true)}>Add user</ActionButton>
          </span>
        )}
      />

      <StatCards items={[
        { label: 'People', value: members.length, icon: 'people' },
        { label: 'Departments', value: departments.length, note: departments.slice(0, 3).join(' · '), icon: 'list' },
        { label: 'QHSE', value: members.filter((m) => m.department === 'QHSE').length, note: 'Compliance & safety' },
        { label: 'Operations', value: members.filter((m) => m.department === 'Operations').length, note: 'Site & plant' },
      ]} />

      <Note tone={info.isAdmin ? 'info' : 'grey'}>
        {info.isAdmin
          ? 'Signed in as the WAGA admin — every password is shown below, including the ones people have changed themselves, so this screen stays the place to look one up. Adding someone issues their login; anyone still on “Login pending” can be issued one here.'
          : 'Each person signs in with their own work email. You can change your own password at any time; the WAGA admin can still read the current one on this screen, which is how a forgotten password gets recovered.'}
      </Note>

      <Section title="People">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search name, email or department…"
          filters={[{ label: 'Department', value: department, onChange: setDepartment, options: departments }]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(m) => setOpenId(idOf(m))}
          empty="No people match these filters."
          columns={[
            {
              key: 'name', label: 'Name',
              render: (m) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <span style={avatar}>{initials(m.name)}</span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                    {m._raised && <span style={raisedChip}>New</span>}
                  </span>
                </span>
              ),
            },
            { key: 'email', label: 'Email', render: (m) => <span style={{ color: '#3640d8', fontSize: 12.5 }}>{m.email}</span> },
            { key: 'department', label: 'Department', width: 190, render: (m) => <StatusBadge tone={deptTone(m.department)}>{m.department || '—'}</StatusBadge> },
            {
              key: 'access', label: 'Access', width: 190, sortable: false,
              render: (m) => {
                const l = loginOf(m)
                if (!l || !l.hasLogin) {
                  // Pending, and for an admin that is now something they can
                  // act on rather than a status to wait out.
                  if (!info.isAdmin) {
                    return <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>Login pending</span>
                  }
                  const busy = issuing === String(m.email || '').toLowerCase()
                  return (
                    <span onClick={(e) => e.stopPropagation()}>
                      <ActionButton variant="ghost" disabled={Boolean(issuing)} onClick={async () => {
                        const res = await issueLogin(m)
                        if (res.ok) {
                          setIssued({ ...m, ...res })
                          store.notify(`Login issued for ${m.name}.`)
                        } else {
                          store.notify(res.message || 'The login could not be issued.', 'error')
                        }
                      }}>
                        {busy ? 'Issuing…' : 'Issue login'}
                      </ActionButton>
                    </span>
                  )
                }
                return (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusBadge tone={l.role === 'admin' ? 'violet' : 'green'}>{l.role === 'admin' ? 'Admin' : 'Active login'}</StatusBadge>
                    {l.loginCount > 0 && <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{l.loginCount} sign-in{l.loginCount === 1 ? '' : 's'}</span>}
                  </span>
                )
              },
            },
            ...(info.isAdmin ? [{
              key: 'password', label: 'Password', width: 200, sortable: false,
              render: (m) => {
                const l = loginOf(m)
                if (!l || !l.password) return <span style={{ color: '#cbd5e1', fontSize: 11.5 }}>—</span>
                const on = revealed[m.email]
                return (
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <code style={pwStyle}>{on ? l.password : '••••••••'}</code>
                    <button onClick={() => setRevealed((r) => ({ ...r, [m.email]: !on }))} style={revealBtn}>{on ? 'Hide' : 'Show'}</button>
                  </span>
                )
              },
            }] : []),
          ]}
        />
      </Section>

      <ModuleActivity
        module="team"
        empty="Nobody has been added in the portal yet."
      />

      <AddMemberModal open={adding} existing={members} departments={deptOptions}
        isAdmin={info.isAdmin} onClose={() => setAdding(false)} onSave={addMember} />
      <MemberModal member={open} login={open ? loginOf(open) : null} isAdmin={info.isAdmin} onClose={() => setOpenId(null)} />
      <IssuedModal issued={issued} onClose={() => setIssued(null)} />
      <ChangePasswordModal open={changingPw} me={info.me} onClose={() => setChangingPw(false)}
        onDone={async (msg) => { setChangingPw(false); store.notify(msg); await loadUsers() }} />
    </div>
  )
}

/** A person, read back. */
function MemberModal({ member, login, isAdmin, onClose }) {
  if (!member) return null
  const access = login?.hasLogin
    ? (login.role === 'admin' ? 'Administrator' : 'Active login')
    : 'Pending — no login issued yet'
  return (
    <Modal open={Boolean(member)} onClose={onClose} title={member.name} subtitle={member.department} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ ...avatar, width: 44, height: 44, fontSize: 14 }}>{initials(member.name)}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{member.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{member.department}</div>
          </div>
        </div>
        <div style={box}>
          <Row k="Email" v={member.email || '—'} />
          <Row k="Department" v={member.department || '—'} />
          <Row k="Reference" v={member.userId || member.recordId} />
          <Row k="Portal access" v={access} last={!(isAdmin && login?.password)} />
          {/* Only the admin's own view carries this, and only when a credential
              actually exists to show. */}
          {isAdmin && login?.password && <Row k="Password" v={login.password} last />}
        </div>
        {login?.hasLogin && login.loginCount > 0 && (
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
            {login.loginCount} sign-in{login.loginCount === 1 ? '' : 's'}
            {login.lastLoginAt ? ` · last on ${new Date(login.lastLoginAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * Add a person to the roster, with their login, in one step.
 *
 * Two different modals behind one button. An admin gets the form; anybody else
 * gets a card naming who to ask, because adding somebody here creates a
 * credential and that is not a member's to create. The button is deliberately
 * shown to both — a control that disappears for some people reads as a bug.
 */
function AddMemberModal({ open, existing, departments, isAdmin, onClose, onSave }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  // Empty, not the first department in the list. It was pre-filled with
  // whichever name sorted first, which reads as an answer somebody gave —
  // "Business Development" arrived on people who had nothing to do with it.
  const [department, setDepartment] = useState('')
  const [newDept, setNewDept] = useState('')
  const [password, setPassword] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setName(''); setEmail(''); setDepartment(''); setNewDept('')
      // Suggested up front rather than after the name is typed: a field that
      // rewrites itself while you look at it is a field you stop trusting.
      // "Generate" re-rolls it with the name once there is one.
      setPassword(suggestPassword('', ''))
    }
  }

  const adding = department === NEW_DEPT
  const resolvedDept = (adding ? newDept : department).trim()
  const shortPassword = password.trim().length > 0 && password.trim().length < MIN_PASSWORD_LENGTH
  const valid = name.trim() && email.trim() && resolvedDept && !shortPassword
  const nextId = () => `WBU-USR-${String(existing.length + 1).padStart(3, '0')}`

  // Not their permission, and the button stays where it is rather than
  // disappearing for some people — a control that vanishes reads as a bug, and
  // "why can't I see it" is a support call. So it opens and says who to ask.
  if (open && !isAdmin) {
    return (
      <Modal open onClose={onClose} title="Add a team member"
        subtitle="Accounts on this trial are set up by iFactory AI" width={480}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionButton onClick={onClose}>Close</ActionButton></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65 }}>
            Adding somebody creates a portal login for them, so it is done by the WAGA
            administrator or by the iFactory AI team — not from a member&apos;s account.
          </div>
          <div style={box}>
            <Row k="Ask" v={USER.name} />
            <Row k="Or write to" v={CONTACT} last />
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Send the person&apos;s full name, work email and department, and their login will be
            issued and passed to them.
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a team member"
      subtitle="A person who works this trial — their portal login is issued with them"
      width={520}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              userId: nextId(), name: name.trim(), email: email.trim(),
              department: resolvedDept, _raised: true, password: password.trim(),
            })}>
            Add user
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marie Laurent" style={input} />
        </Field>
        <Field label="Work email" required>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. marie.laurent@waga-energy.com" style={input} />
        </Field>
        {/* A list, not a free-text box with a datalist behind it.
            The old field looked like a text input, so the browser offered its
            own autofill over the top of it and the real departments were never
            what you saw. A select shows all of them and cannot be half-typed —
            with one entry at the bottom for the department that does not exist
            yet, because a roster that cannot grow a department is a roster
            somebody works around by mistyping an existing one. */}
        <Field label="Department" required>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}
            style={{ ...input, cursor: 'pointer' }}>
            <option value="" disabled>Select a department…</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value={NEW_DEPT}>+ Add a new department…</option>
          </select>
        </Field>

        {adding && (
          <Field label="New department" required>
            <input value={newDept} onChange={(e) => setNewDept(e.target.value)}
              placeholder="e.g. Asset Integrity" autoFocus style={input} />
            <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
              It joins the list once somebody is in it.
            </span>
          </Field>
        )}
        {/* The password is on the form, not behind it.
            Adding somebody used to hand back a password only after the fact,
            which left an admin looking at a roster row wondering what had been
            set. It is suggested here, it can be replaced here, and what is on
            screen is exactly what gets stored. */}
        <Field label="Password" required>
          <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="at least six characters" style={{ ...input, flex: 1, minWidth: 0 }} />
            <ActionButton variant="ghost" onClick={() => setPassword(suggestPassword(name, email))}>
              Generate
            </ActionButton>
          </span>
          {shortPassword
            ? <span style={warn}>At least {MIN_PASSWORD_LENGTH} characters.</span>
            : (
              <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
                Suggested — change it if you like. They can change it themselves once they are in.
              </span>
            )}
        </Field>

        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
          Adding a person creates their directory entry and their portal login in one step. The
          password stays readable on the roster, so it can be looked up again.
        </div>
      </div>
    </Modal>
  )
}

/**
 * What was just issued, shown once and plainly.
 *
 * It is on the roster as well, so this is not the only copy — but an admin who
 * has just created somebody is about to read a password out to them, and making
 * them hunt for the row they just made is the kind of small friction that ends
 * with the credential never being passed on.
 */
function IssuedModal({ issued, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!issued) return null
  const signIn = typeof window === 'undefined' ? '' : `${window.location.origin}/portal/waga/login`
  // An existing account keeps its own password, so there may be nothing to show.
  const hasPassword = Boolean(issued.password)

  return (
    <Modal open onClose={onClose} title={hasPassword ? 'Login issued' : 'Portal access granted'}
      subtitle={issued.name} width={480}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionButton onClick={onClose}>Done</ActionButton></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={box}>
          <Row k="Sign in at" v={signIn} />
          <Row k="Username" v={issued.email} last={!hasPassword} />
          {hasPassword && <Row k="Password" v={issued.password} last />}
        </div>

        {hasPassword && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ActionButton variant="ghost" onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${signIn}\n${issued.email}\n${issued.password}`)
                setCopied(true)
              } catch { /* the values are on screen either way */ }
            }}>
              {copied ? 'Copied' : 'Copy all three'}
            </ActionButton>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
              They can change it themselves once they are in.
            </span>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
          {issued.message}
        </div>
      </div>
    </Modal>
  )
}

/**
 * Change your own password.
 *
 * Your own only — the server reads the account from the cookie and ignores
 * anything sent about whose password this is, so there is no version of this
 * form that edits somebody else.
 *
 * The current password is asked for even though the session already proves who
 * you are: it is what stops a borrowed unlocked laptop from becoming a changed
 * credential.
 */
function ChangePasswordModal({ open, me, onClose, onDone }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) { setCurrent(''); setNext(''); setAgain(''); setError('') }
  }

  // Six is the schema's own minimum; asking for more here and less there would
  // mean a password this form rejects that the database would have taken.
  const tooShort = next.length > 0 && next.length < 6
  const mismatch = again.length > 0 && next !== again
  const valid = current && next.length >= 6 && next === again

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await fetch(apiUrl('/api/portal/waga/users'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.message || 'The password could not be changed.'); return }
      onDone(d.message || 'Password changed.')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change my password"
      subtitle={me?.email || ''} width={460}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid || busy} onClick={save}>
            {busy ? 'Saving…' : 'Change password'}
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Current password" required>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password" style={input} />
        </Field>
        <Field label="New password" required>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password" style={input} />
          {tooShort && <span style={warn}>At least six characters.</span>}
        </Field>
        <Field label="New password again" required>
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password" style={input} />
          {mismatch && <span style={warn}>These two do not match.</span>}
        </Field>

        {error && <div style={{ ...warn, fontSize: 12 }}>{error}</div>}

        {/* Said plainly rather than buried. The admin can read every password on
            this screen — that is how a forgotten one is recovered here — and
            somebody choosing a new password should know that before they reuse
            one they use elsewhere. */}
        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
          The WAGA administrator can read the current password for every account on this screen,
          including this one after you change it. Do not reuse a password from another system.
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: last ? 'none' : '1px solid #eef2f7' }}>
      <span style={{ fontSize: 11.5, color: '#94a3b8', flex: '0 0 120px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

const initials = (name = '') => name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

const DEPT_TONE = { QHSE: 'green', Operations: 'blue', 'Project Delivery': 'violet', 'Business Development': 'amber', Finance: 'grey' }
const deptTone = (d) => DEPT_TONE[d] || 'grey'

const avatar = {
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 9.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const raisedChip = {
  fontSize: 9.5, fontWeight: 800, letterSpacing: '.03em', color: '#3640d8',
  background: '#eef1ff', border: '1px solid #dbe2ff', borderRadius: 999, padding: '1px 7px',
}
const box = { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' }
const warn = { display: 'block', marginTop: 6, fontSize: 11.5, color: '#dc2626', fontWeight: 600 }
const pwStyle = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, color: '#0f172a', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', letterSpacing: '0.02em' }
const revealBtn = { fontSize: 10.5, fontWeight: 700, color: '#15227a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
