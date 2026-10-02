'use client'

// White label — the branding a reseller or a large customer applies.
//
// The preview is the point of this screen. A colour picker with no preview asks
// someone to imagine the result, and the whole reason branding gets signed off
// slowly is that nobody can. So every control here repaints the sample sidebar
// and header beside it immediately, using the same shapes the real shell uses.

import { useState } from 'react'
import { PageHeader, Card, Section, Fields, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { ORG } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const PRESETS = [
  { name: 'Oxmaint', primary: '#15227a', accent: '#f5b700' },
  { name: 'Slate', primary: '#334155', accent: '#0ea5e9' },
  { name: 'Forest', primary: '#14532d', accent: '#84cc16' },
  { name: 'Ember', primary: '#7c2d12', accent: '#f97316' },
  { name: 'Plum', primary: '#4c1d95', accent: '#c084fc' },
]

export default function WhiteLabel() {
  const [brand, setBrand] = useState({
    product_name: 'Oxmaint AI',
    primary: '#15227a',
    accent: '#f5b700',
    domain: 'maintenance.oxmaint.example',
    login_message: 'Sign in to Oxmaint AI maintenance.',
    hide_powered_by: false,
    email_from: 'maintenance@oxmaint.example',
  })

  const set = (k, v) => setBrand((p) => ({ ...p, [k]: v }))

  return (
    <div>
      <PageHeader
        icon={sectionIcon('white-label', '#15227a')}
        title="White Label"
        subtitle={`Brand the product as ${ORG.organization_name}`}
        right={<ActionButton onClick={() => {}}>Publish branding</ActionButton>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div>
          <Section title="Identity">
            <Field label="Product name">
              <input value={brand.product_name} onChange={(e) => set('product_name', e.target.value)} style={input} />
            </Field>
            <Field label="Custom domain">
              <input value={brand.domain} onChange={(e) => set('domain', e.target.value)} style={input} />
            </Field>
            <Field label="Sign-in message">
              <input value={brand.login_message} onChange={(e) => set('login_message', e.target.value)} style={input} />
            </Field>
            <Field label="System email from">
              <input value={brand.email_from} onChange={(e) => set('email_from', e.target.value)} style={input} />
            </Field>
            <div style={{ ...row, borderBottom: 'none' }}>
              <span style={label}>Hide &ldquo;powered by&rdquo;</span>
              <Toggle on={brand.hide_powered_by} onClick={() => set('hide_powered_by', !brand.hide_powered_by)} />
            </div>
          </Section>

          <Section title="Colour">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setBrand((b) => ({ ...b, primary: p.primary, accent: p.accent }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
                    border: `1px solid ${brand.primary === p.primary ? p.primary : LINE}`,
                    background: brand.primary === p.primary ? '#f8fafc' : '#fff', color: SUB,
                  }}>
                  <span style={{ width: 13, height: 13, borderRadius: 4, background: p.primary }} />
                  <span style={{ width: 13, height: 13, borderRadius: 4, background: p.accent }} />
                  {p.name}
                </button>
              ))}
            </div>
            <Field label="Primary">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={brand.primary} onChange={(e) => set('primary', e.target.value)} style={swatch} />
                <input value={brand.primary} onChange={(e) => set('primary', e.target.value)} style={{ ...input, maxWidth: 120 }} />
              </div>
            </Field>
            <Field label="Accent">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={brand.accent} onChange={(e) => set('accent', e.target.value)} style={swatch} />
                <input value={brand.accent} onChange={(e) => set('accent', e.target.value)} style={{ ...input, maxWidth: 120 }} />
              </div>
            </Field>
          </Section>

          <Section title="Logo">
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
              Two files are needed, not one: a wide lockup for the header and a square mark for the
              collapsed rail and the browser tab. Using one for both is what makes a wordmark
              unreadable at 30 pixels.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {['Wide lockup — 626 × 71', 'Square mark — 512 × 512'].map((t) => (
                <div key={t} style={{
                  flex: 1, padding: '20px 12px', textAlign: 'center', borderRadius: 11,
                  border: `1px dashed ${LINE}`, background: '#fcfdfe',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: SUB }}>Upload</div>
                  <div style={{ fontSize: 10.5, color: MUTE, marginTop: 3 }}>{t}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Preview" right={<StatusBadge tone="blue">Live</StatusBadge>}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
            <div style={{ display: 'flex', height: 300 }}>
              <div style={{ width: 118, background: '#fff', borderRight: `1px solid ${LINE}`, padding: 10 }}>
                <div style={{
                  border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 8px',
                  textAlign: 'center', marginBottom: 10,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, margin: '0 auto 6px',
                    background: brand.primary,
                  }} />
                  <div style={{ fontSize: 9, fontWeight: 800, color: brand.primary, lineHeight: 1.2 }}>
                    {brand.product_name}
                  </div>
                </div>
                {['Dashboard', 'Work Orders', 'Assets', 'Inventory'].map((t, i) => (
                  <div key={t} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 7px', borderRadius: 7,
                    marginBottom: 2, fontSize: 9.5, fontWeight: i === 0 ? 700 : 500,
                    background: i === 0 ? `${brand.primary}14` : 'transparent',
                    color: i === 0 ? brand.primary : '#64748b',
                  }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: i === 0 ? brand.primary : '#cbd5e1' }} />
                    {t}
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  height: 34, background: '#fff', borderBottom: `1px solid ${LINE}`,
                  display: 'flex', alignItems: 'center', padding: '0 11px', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: brand.primary }}>
                    {brand.product_name.split(' ')[0]}{' '}
                    <span style={{ color: brand.accent }}>{brand.product_name.split(' ').slice(1).join(' ')}</span>
                  </span>
                  <span style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: brand.primary }} />
                </div>

                <div style={{ padding: 11 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 8 }}>Dashboard</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 9 }}>
                    {['49', '11', '91%'].map((v, i) => (
                      <div key={i} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 8px' }}>
                        <div style={{ fontSize: 7.5, color: MUTE, fontWeight: 700, letterSpacing: 0.3 }}>METRIC</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button style={{
                    padding: '6px 12px', fontSize: 10, fontWeight: 700, borderRadius: 7,
                    border: 'none', background: brand.primary, color: '#fff', fontFamily: 'inherit',
                  }}>New work order</button>
                  {!brand.hide_powered_by && (
                    <div style={{ fontSize: 8.5, color: '#cbd5e1', marginTop: 12 }}>Powered by Oxmaint</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Fields rows={[
              ['Domain', brand.domain],
              ['Emails from', brand.email_from],
              ['Sign-in message', brand.login_message],
              ['Attribution', brand.hide_powered_by ? 'Hidden' : 'Shown'],
            ]} columns={1} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Field({ label: text, children }) {
  return (
    <div style={row}>
      <span style={label}>{text}</span>
      <div style={{ flex: 1, maxWidth: 260 }}>{children}</div>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <span role="button" onClick={onClick} style={{
      width: 34, height: 19, borderRadius: 999, flexShrink: 0, position: 'relative',
      background: on ? '#15227a' : '#cbd5e1', cursor: 'pointer', transition: 'background .15s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%',
        background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(15,23,42,0.2)',
      }} />
    </span>
  )
}

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}` }
const label = { fontSize: 12.5, color: SUB, fontWeight: 600 }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: 12.5,
  border: `1px solid ${LINE}`, borderRadius: 8, outline: 'none', fontFamily: 'inherit', color: INK,
}
const swatch = { width: 34, height: 32, padding: 0, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer' }
