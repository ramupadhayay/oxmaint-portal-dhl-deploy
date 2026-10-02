'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, Card, Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { LOGBOOK, SITES, fmtDate, USER } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const CATEGORY_TONE = { Handover: 'blue', Breakdown: 'red', Observation: 'grey', Safety: 'amber' }

// A logbook is read as a timeline, not as a table — the question is "what
// happened on nights, in order", not "sort by column". So this screen groups by
// shift date and lays each shift out as a card, which is how the paper book it
// replaces is actually read.
const idOf = (e) => e.entry_id || e.recordId

export default function ShiftLogbook() {
  const { scope, siteName, siteId } = useSite()
  const { create } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [shift, setShift] = useState('all')
  const [draft, setDraft] = useState('')
  const [entryShift, setEntryShift] = useState('Morning')
  const [entryCategory, setEntryCategory] = useState('Handover')

  const merged = useRecords('logbook', LOGBOOK, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((e) => (
      (category === 'all' || e.category === category) &&
      (shift === 'all' || e.shift === shift) &&
      (!q || [e.note, e.author_name, e.asset_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, shift])

  const byDay = useMemo(() => {
    const map = new Map()
    rows.forEach((e) => {
      const day = String(e.shift_date || '').slice(0, 10)
      map.set(day, [...(map.get(day) || []), e])
    })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  const addEntry = async () => {
    const note = draft.trim()
    if (!note) return
    // Cleared straight away rather than after the round trip: the store rolls
    // the entry back and says so if the save fails, so holding the text hostage
    // to the network only makes the good path feel slow.
    setDraft('')
    await create('logbook', {
      shift: entryShift,
      shift_date: new Date().toISOString(),
      author_name: USER.name,
      category: entryCategory,
      note,
      asset_name: '—',
      status: entryCategory === 'Breakdown' || entryCategory === 'Safety' ? 'Open' : 'Closed',
      site_id: siteId === 'all' ? SITES[0].site_id : siteId,
    })
  }

  return (
    <div>
      <PageHeader
        icon={sectionIcon('logbook', '#15227a')}
        title="Shift Logbook"
        subtitle={`Electronic handover record · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Entries', value: all.length },
        { label: 'Open items', value: all.filter((e) => e.status === 'Open').length, tone: 'amber' },
        { label: 'Breakdowns logged', value: all.filter((e) => e.category === 'Breakdown').length, tone: 'red' },
        { label: 'Safety notes', value: all.filter((e) => e.category === 'Safety').length },
        { label: 'Shifts covered', value: byDay.length },
      ]} />

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <div style={avatar}>{USER.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a handover note for this shift…"
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 11px',
                fontSize: 13, lineHeight: 1.5, border: `1px solid ${LINE}`, borderRadius: 9,
                outline: 'none', fontFamily: 'inherit', color: INK,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={entryShift} onChange={(e) => setEntryShift(e.target.value)} style={pill}>
                {['Morning', 'Afternoon', 'Night'].map((s) => <option key={s} value={s}>{s} shift</option>)}
              </select>
              <select value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} style={pill}>
                {['Handover', 'Breakdown', 'Observation', 'Safety'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ marginLeft: 'auto' }}>
                <ActionButton onClick={addEntry} disabled={!draft.trim()}>Add entry</ActionButton>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search notes, author, asset…"
        filters={[
          { label: 'Category', value: category, onChange: setCategory, options: ['Handover', 'Breakdown', 'Observation', 'Safety'] },
          { label: 'Shift', value: shift, onChange: setShift, options: ['Morning', 'Afternoon', 'Night'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} entries</span>}
      />

      {byDay.length ? byDay.map(([day, entries]) => (
        <Section key={day} title={fmtDate(day)}
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>}>
          {entries.map((e) => (
            <div key={idOf(e)} style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ ...avatar, width: 30, height: 30, fontSize: 10.5 }}>
                {e.author_name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{e.author_name}</span>
                  <StatusBadge tone={CATEGORY_TONE[e.category]}>{e.category}</StatusBadge>
                  <span style={{ fontSize: 11, color: MUTE }}>{e.shift} shift</span>
                  {e.status === 'Open' && <StatusBadge>Open</StatusBadge>}
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{e.note}</p>
                {e.asset_name && e.asset_name !== '—' && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTE }}>Asset: {e.asset_name}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )) : (
        <Card><div style={{ padding: '30px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No entries match these filters.</div></Card>
      )}
    </div>
  )
}

const avatar = {
  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const pill = {
  padding: '5px 9px', fontSize: 11.5, fontWeight: 700, color: '#15227a', background: '#f8fafc',
  border: '1px solid #e8ecf1', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
