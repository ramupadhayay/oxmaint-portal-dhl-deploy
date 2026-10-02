'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { ORG, USER, between } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

// ── one screen, several entries ───────────────────────────────────────────
//
// The product gives each of these its own route in the sidebar, and this build
// had them behind one entry with tabs. The tabs were already the product's own
// sub-modules, so the content did not need writing — it needed addressing. Each
// entry opens its tab, and walking to the next one moves the tab rather than
// leaving the reader on the screen they have just navigated away from.
const TABS = ['Resources', 'Raise a ticket', 'Contact us', 'FAQ', 'Terms of service', 'Privacy policy']

const TAB_FOR_SECTION = {
  help: 'Resources',
  'help-resources': 'Resources',
  'help-ticket': 'Raise a ticket',
  'help-contact': 'Contact us',
  'help-faq': 'FAQ',
  'help-terms': 'Terms of service',
  'help-privacy': 'Privacy policy',
}

const CATEGORIES = ['Work orders', 'Assets and locations', 'Preventive maintenance', 'Inventory and purchasing', 'Reporting', 'Users and access', 'Integrations', 'Billing']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

// Published response targets, so the confirmation can tell somebody when to
// expect an answer rather than leaving them to guess.
const RESPONSE = {
  Critical: 'within 1 hour, any time of day',
  High: 'within 4 working hours',
  Medium: 'by the end of the next working day',
  Low: 'within 2 working days',
}

const RESOURCES = [
  { key: 'getting-started', title: 'Getting started guide', blurb: 'The setup order that works: sites, assets, people, schedules. Each step measured against your own data.' },
  { key: 'kpis', title: 'KPI definitions', blurb: 'What every indicator means and exactly how it is worked out, so two people reading the same number agree.' },
  { key: 'work-orders', title: 'Work order lifecycle', blurb: 'Raising, assigning, holding and closing a job, and what each status change does to the backlog figures.' },
  { key: 'pm-schedules', title: 'Preventive maintenance setup', blurb: 'Time-based and meter-based schedules, frequency, generation windows and how compliance is measured.' },
  { key: 'parts', title: 'Stores and reorder points', blurb: 'Reorder points, demand lines and the route from a shortage on the shelf to a purchase order.' },
  { key: 'integrations', title: 'Integrations and data import', blurb: 'Connecting an ERP, a historian or an identity provider, and what synchronises in each direction.' },
  { key: 'reports', title: 'Reporting and exports', blurb: 'The standard cuts — cost, downtime, backlog, compliance — and how to get them out of the product.' },
  { key: 'ai-auditor', title: 'Data quality auditing', blurb: 'The checks the auditor runs, what each finding means and the order worth fixing them in.' },
]

const FAQ = [
  {
    q: 'What is the difference between a maintenance request and a work order?',
    a: 'A request is somebody asking for work: an operator reports a noise, a supervisor asks for a guard to be refitted. It carries no schedule and no cost. A work order is the committed job — it has an owner, a due date, estimated hours and a cost account. Requests are reviewed and either turned into a work order or declined with a reason. Keeping the two apart is what stops the backlog filling with things nobody has agreed to do.',
  },
  {
    q: 'How is PM compliance calculated?',
    a: 'It is the share of preventive schedules still inside their due window, counted at the moment you load the page: schedules not past due, divided by all schedules in scope. A schedule one day late counts as non-compliant, the same as one a month late — the measure is binary on purpose, because a plant that treats a small slip as acceptable soon treats a large one the same way.',
  },
  {
    q: 'Where does the asset health score come from?',
    a: 'It is a condition index held against the asset and updated from condition monitoring, inspection results and failure history. It is a summary, not a measurement: use it to rank what to look at, and use the underlying readings on the Digital Twin screen to decide what to do. Any screen that models rather than counts says so on the screen.',
  },
  {
    q: 'Why do figures change when I switch site in the header?',
    a: 'Because every screen recounts against the site you have chosen — headline figures, charts and tables alike. Records that belong to the organisation rather than to a site, such as suppliers and user accounts, stay visible under every filter. The filter follows you between pages, so if a screen looks emptier than expected, check the site picker first.',
  },
  {
    q: 'What happens when a part drops below its reorder point?',
    a: 'The line is marked Low Stock and appears on the stock alert list. A demand line can then be raised against it, which is what purchasing works from when creating an order. Reaching zero moves the line to Out of Stock. The reorder point itself is set per part and should reflect supplier lead time, not just how fast the part is consumed.',
  },
  {
    q: 'Can a failed inspection raise its own work order?',
    a: 'Yes. A workflow rule can create a corrective work order the moment an inspection is closed with a Fail result, carrying the findings across and assigning it to the inspecting trade. Where that rule is not switched on, the AI Auditor lists failed inspections with no follow-up so nothing quietly closes without a fix.',
  },
  {
    q: 'How is MTTR worked out here?',
    a: 'Mean time to repair is the average of the actual hours booked to completed work orders in scope. It measures hands-on repair time, not the calendar time a machine was unavailable — that is downtime, reported separately. The two diverge when jobs wait for parts or for a production window, and the gap between them is usually the most useful number on the page.',
  },
  {
    q: 'Who can approve a purchase order?',
    a: 'Approval follows the authorisation limits set against each role. An order above a role limit escalates to the next level automatically, and every approval is written to the audit trail with the approver, the time and the amount. Nobody can approve an order they raised themselves.',
  },
  {
    q: 'How do I take an asset out of service without losing its history?',
    a: 'Change its status rather than deleting the record. Assets are never removed, because deleting one would take its work orders, costs and inspection results with it and leave every historical report wrong. A retired asset stops appearing in active lists and in scheduling, and its history stays available on the asset record and in reports.',
  },
  {
    q: 'What happens to a schedule when the work order it generated is cancelled?',
    a: 'The schedule stays live and generates again at the next interval — cancelling one occurrence does not cancel the plan. If the work genuinely is not needed, pause or retire the schedule instead, so the reason is recorded once rather than repeated every cycle by whoever is on shift.',
  },
]

export default function Help({ section }) {
  const router = useRouter()
  const [tab, setTab] = useState(TAB_FOR_SECTION[section] || 'Resources')

  // Walking from one entry to the next moves the tab. Without it the route
  // changes and the screen does not, which reads as a menu item that does
  // nothing.
  useEffect(() => {
    const wanted = TAB_FOR_SECTION[section]
    if (wanted) setTab(wanted)
  }, [section])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('help', '#15227a')}
        title="Help and Support"
        subtitle={`${ORG.organization_name} · ${ORG.subscription_plan} plan · support included`}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? ACCENT : LINE}`,
            background: tab === t ? ACCENT : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Resources' && (
        <Section title="Guides">
          <p style={{ margin: '0 0 14px', fontSize: 13, color: SUB, lineHeight: 1.55, maxWidth: 720 }}>
            Each guide opens the screen it describes, so you can read it with your own data in front of
            you rather than against screenshots of another plant.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(276px,1fr))', gap: 12 }}>
            {RESOURCES.map((r) => (
              <div key={r.key} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 15, background: '#fcfdfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  {sectionIcon(r.key, ACCENT)}
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{r.title}</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.5 }}>{r.blurb}</p>
                <button onClick={() => router.push('/portal/oxmaint/' + r.key)} style={{
                  background: 'none', border: 'none', padding: 0, color: ACCENT,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>Open the screen →</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'Raise a ticket' && <TicketForm />}

      {tab === 'Contact us' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
            <Section title="Support desk" style={{ marginBottom: 0 }}>
              <ContactRow label="Email" value="support@oxmaint.example" />
              <ContactRow label="Telephone" value="+44 114 496 0100" />
              <ContactRow label="Hours" value="08:00 to 18:00, Monday to Friday" />
              <ContactRow label="Out of hours" value="Critical tickets only, 24 hours a day" />
              <ContactRow label="Portal" value="Raise a ticket on the previous tab" last />
            </Section>
            <Section title="Your account" style={{ marginBottom: 0 }}>
              <ContactRow label="Organisation" value={`${ORG.organization_name} (${ORG.organization_code})`} />
              <ContactRow label="Plan" value={`${ORG.subscription_plan} · ${ORG.subscription_status}`} />
              <ContactRow label="Administrator" value={`${USER.name} · ${USER.email}`} />
              <ContactRow label="Registered address" value={`${ORG.address}, ${ORG.city}, ${ORG.country}`} />
              <ContactRow label="Time zone" value={ORG.timezone} last />
            </Section>
          </div>

          <Section title="Escalation">
            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.6, maxWidth: 760 }}>
              If a ticket has not been answered inside its published target, reply to the ticket with the
              word Escalate in the subject line and it moves to the duty support manager immediately. A
              ticket that stops production is always treated as critical, whatever it was raised as.
            </p>
          </Section>
        </>
      )}

      {tab === 'FAQ' && <Faq />}

      {tab === 'Terms of service' && (
        <Section title="Terms of service">
          <DemoNotice />
          <Legal paragraphs={[
            ['What this covers', 'These terms describe how the maintenance platform is provided to your organisation and what each side is responsible for. They apply to everyone who signs in under your account, whether they are an employee, a contractor or a supplier given limited access.'],
            ['Your account', 'You control who has access and what they may do. Sign-in details are personal and must not be shared. Tell us promptly if an account needs to be closed, and it is removed from every site in the account at once.'],
            ['Your data', 'The maintenance records you enter remain yours. We hold them so the service can run, and we do not sell them or use them to train anything outside your account. You can export your data at any time while the subscription is live, and for thirty days after it ends.'],
            ['Availability', 'The service is provided with a published availability target and a maintenance window notified in advance. Planned work is scheduled outside normal working hours in your registered time zone wherever it is possible to do so.'],
            ['Fair use', 'The subscription includes a stated number of users, assets and connected systems. If you exceed them we will tell you before anything is restricted, and give you the chance to move to a larger plan.'],
            ['Ending the agreement', 'Either side may end the subscription at the end of a billing period with reasonable notice. On termination we make an export of your data available for thirty days, after which it is deleted from the live service and from backups on the published cycle.'],
          ]} />
        </Section>
      )}

      {tab === 'Privacy policy' && (
        <Section title="Privacy policy">
          <DemoNotice />
          <Legal paragraphs={[
            ['What we collect', 'Enough to run the service and no more: the name, work email address and role of each user, the maintenance records your team enters, and technical logs of who signed in and what they changed. We do not collect personal data about your customers through this product.'],
            ['Why we hold it', 'To provide the service, to keep an audit trail your auditors can rely on, to support you when something goes wrong, and to meet legal obligations such as retaining safety records for the required period.'],
            ['Who can see it', 'Your own users, according to the permissions you set, and the small number of our support staff who need access to resolve a ticket you have raised. Support access is logged. We do not pass your data to anyone else except where the law requires it.'],
            ['Where it is held', 'In the region agreed with your organisation. Backups stay in the same region. If that ever needs to change, you are told before it happens, not after.'],
            ['How long we keep it', 'For as long as the subscription is live, and then for thirty days so an export can be taken. Audit records covering safety and compliance are held for the retention period required by law even where the underlying record has been closed.'],
            ['Your rights', 'Individuals can ask what personal data is held about them, ask for it to be corrected, and in most cases ask for it to be deleted. Requests can be made through your administrator or directly to the support desk, and are answered inside one month.'],
          ]} />
        </Section>
      )}
    </div>
  )
}

// ── ticket form ───────────────────────────────────────────────────────────
function TicketForm() {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [priority, setPriority] = useState('Medium')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [history, setHistory] = useState([])

  const submit = () => {
    if (!subject.trim() || !description.trim()) {
      setError('A subject and a description are both needed before a ticket can be raised.')
      return
    }
    // The reference is hashed from the subject and the position in this session
    // rather than drawn at random, so the same demo produces the same number.
    const ticket = {
      reference: `SUP-${between(`ticket-${history.length}-${subject}`, 10000, 99999)}`,
      category,
      priority,
      subject: subject.trim(),
      description: description.trim(),
      response: RESPONSE[priority],
    }
    setHistory((prev) => [ticket, ...prev])
    setSubmitted(ticket)
    setError('')
  }

  const reset = () => {
    setSubject('')
    setDescription('')
    setPriority('Medium')
    setCategory(CATEGORIES[0])
    setSubmitted(null)
  }

  if (submitted) {
    return (
      <>
        <Card style={{ marginBottom: 14, borderLeft: `3px solid ${GREEN}` }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', background: '#ecfdf5', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 4 }}>
                Ticket {submitted.reference} raised
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: SUB, lineHeight: 1.55 }}>
                A confirmation has gone to {USER.email}. At {submitted.priority.toLowerCase()} priority you
                should expect a first response {submitted.response}.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, padding: 13, borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
                <Detail label="Category" value={submitted.category} />
                <Detail label="Priority" value={submitted.priority} />
                <Detail label="Subject" value={submitted.subject} />
              </div>
              <div style={{ marginTop: 13 }}>
                <ActionButton variant="subtle" onClick={reset}>Raise another ticket</ActionButton>
              </div>
            </div>
          </div>
        </Card>
        <TicketHistory history={history} />
      </>
    )
  }

  return (
    <>
      <Section title="Raise a support ticket">
        <p style={{ margin: '0 0 16px', fontSize: 13, color: SUB, lineHeight: 1.55, maxWidth: 720 }}>
          Tell us what you were trying to do and what happened instead. Where a specific record is
          involved, include its number — a work order or asset code turns a long exchange into a short one.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 14 }}>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
              placeholder="Short summary, for example: cannot close work order WO-2617" style={inputStyle} />
          </Field>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
              placeholder="What you did, what you expected, and what happened instead."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
        </div>

        <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 14 }}>
          Expected first response at {priority.toLowerCase()} priority: {RESPONSE[priority]}.
        </div>

        {error && (
          <div style={{ padding: '10px 13px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <ActionButton onClick={submit}>Submit ticket</ActionButton>
      </Section>
      <TicketHistory history={history} />
    </>
  )
}

function TicketHistory({ history }) {
  if (!history.length) return null
  return (
    <Section title={`Raised in this session (${history.length})`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {history.map((t) => (
          <div key={t.reference} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, minWidth: 92 }}>{t.reference}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK }}>{t.subject}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: MUTE, marginTop: 2 }}>{t.category} · first response {t.response}</span>
            </span>
            <StatusBadge>{t.priority}</StatusBadge>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────
function Faq() {
  const [open, setOpen] = useState(() => new Set([FAQ[0].q]))

  const toggle = (q) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(q)) next.delete(q)
    else next.add(q)
    return next
  })

  return (
    <Section title={`Frequently asked questions (${FAQ.length})`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {FAQ.map((item) => {
          const isOpen = open.has(item.q)
          return (
            <div key={item.q} style={{ borderBottom: `1px solid ${LINE}` }}>
              <button onClick={() => toggle(item.q)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '13px 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: isOpen ? ACCENT : INK, lineHeight: 1.45 }}>{item.q}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? ACCENT : MUTE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {isOpen && (
                <p style={{ margin: '0 0 14px', paddingRight: 28, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>{item.a}</p>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── small pieces ──────────────────────────────────────────────────────────
function DemoNotice() {
  return (
    <div style={{ padding: '11px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 16 }}>
      <span style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>
        <strong style={{ color: '#b45309' }}>Summary only.</strong> This is a plain-language
        outline, not a legal document. The agreement that governs a live
        subscription is the signed one, and it takes precedence over everything on this page.
      </span>
    </div>
  )
}

function Legal({ paragraphs }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780 }}>
      {paragraphs.map(([heading, body]) => (
        <div key={heading}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 5 }}>{heading}</div>
          <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>{body}</p>
        </div>
      ))}
    </div>
  )
}

function ContactRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={{ fontSize: 12.5, color: SUB, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  )
}

function Detail({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: INK, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
  fontFamily: 'inherit', outline: 'none',
}
