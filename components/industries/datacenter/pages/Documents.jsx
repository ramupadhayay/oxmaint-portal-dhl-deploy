'use client'

// Documents — the estate's asset library.
//
// On a data center the document library is primarily an asset library: O&M
// manuals, wiring and P&ID drawings, calibration certificates and commissioning
// reports, each tied to a real asset from the scope matrix and its manufacturer.
// It is its own section rather than a corner of Teams, because that is what the
// estate actually reaches for. Documents added here persist under the portal's
// own record kind; the register exports to PDF and to Excel, and a new document
// is added from a file on the operator's own computer.

import { useMemo, useState } from 'react'
import { Toolbar, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import DocumentUpload from '../components/DocumentUpload'
import { useSite } from '../lib/siteStore'
import { useDocumentStore } from '../lib/store'
import { FASM_ASSETS } from '../lib/data/fasm'
import { MANUFACTURERS, listOf } from '../lib/data'
import { DC_DOCUMENTS, DOC_TYPES, DOC_CATEGORIES } from '../lib/orgData'
import { reportsPdf } from '../lib/reportsPdf'
import { openDocument } from '../lib/documentPdf'

const { MUTE, SUB, INK, LINE, ACCENT } = PALETTE

// The asset a document is tied to — its class and manufacturer are what let the
// opened document read as this estate's paperwork rather than a blank template.
const assetOf = (id) => FASM_ASSETS.find((a) => a.assetId === id) || null

const TABS = [{ key: 'library', label: 'Document library' }, { key: 'manufacturers', label: 'Manufacturers' }]

const TYPE_TONE = { PDF: 'red', DWG: 'blue', XLSX: 'green', CSV: 'green', DOCX: 'blue', IMG: 'amber', TXT: 'grey' }
const size = (kb) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)
const fmt = (d) => { const x = new Date(`${d}T00:00:00`); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
const today = () => new Date().toISOString().slice(0, 10)

export default function Documents() {
  const { siteName } = useSite()
  const store = useDocumentStore()
  const [tab, setTab] = useState('library')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [mfrSearch, setMfrSearch] = useState('')

  const all = useMemo(() => {
    const seededIds = new Set(DC_DOCUMENTS.map((d) => d.document_id))
    // `_created` marks the rows raised in the portal — the only ones that can be
    // deleted, because they are the only ones in the database.
    const created = store.created.filter((r) => !seededIds.has(r.document_id)).map((r) => ({ ...r, _created: true }))
    return [...created, ...DC_DOCUMENTS]
  }, [store.created])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => (
      (type === 'all' || d.document_type === type) &&
      (category === 'all' || d.category === category) &&
      (!q || [d.document_name, d.asset_name, d.manufacturer, d.uploaded_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, type, category])

  const stats = [
    { label: 'Documents', value: all.length, icon: 'list' },
    { label: 'Manuals', value: all.filter((d) => d.category === 'Manual').length, icon: 'list' },
    { label: 'Drawings', value: all.filter((d) => d.document_type === 'DWG').length, icon: 'chart' },
    { label: 'Certificates', value: all.filter((d) => d.category === 'Certificate').length, icon: 'tick' },
    { label: 'Total size', value: size(all.reduce((n, d) => n + (Number(d.size_kb) || 0), 0)), icon: 'list' },
  ]

  const columns = [
    { key: 'document_name', label: 'Document', render: (r) => <span style={{ fontWeight: 600, color: ACCENT }}>{r.document_name}</span> },
    { key: 'document_type', label: 'Type', render: (r) => <StatusBadge tone={TYPE_TONE[r.document_type] || 'grey'}>{r.document_type}</StatusBadge> },
    { key: 'category', label: 'Category' },
    { key: 'asset_name', label: 'Asset' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'size_kb', label: 'Size', align: 'right', render: (r) => size(r.size_kb) },
    { key: 'uploaded_by_name', label: 'Uploaded by' },
    { key: 'created_date', label: 'Uploaded', sortValue: (r) => new Date(`${r.created_date}T00:00:00`).getTime(), render: (r) => fmt(r.created_date) },
    {
      key: '_del', label: '', align: 'right',
      render: (r) => (r._created ? (
        <button onClick={(e) => { e.stopPropagation(); onDelete(r) }} title="Delete document" style={styles.del}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      ) : <span style={{ fontSize: 10.5, color: '#cbd5e1' }} title="Seeded record">—</span>),
    },
  ]

  const onDelete = async (r) => {
    if (busy || !window.confirm(`Delete “${r.document_name}”? This cannot be undone.`)) return
    setBusy(true)
    try { await store.remove(r.recordId) } finally { setBusy(false) }
  }

  const submit = async (doc) => {
    const asset = FASM_ASSETS.find((a) => a.assetId === doc.asset_id)
    await store.create({
      document_id: `DCDOC-${Date.now().toString(36).slice(-5)}`,
      ...doc,
      site_id: asset?.siteId || null,
      created_date: today(),
    })
  }

  // Excel — a real .xlsx of what is shown, via SheetJS. Loaded on demand so its
  // ~1MB never lands in the page's own chunk.
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const data = rows.map((r) => ({
      Document: r.document_name, Type: r.document_type, Category: r.category,
      Asset: r.asset_name, Manufacturer: r.manufacturer, 'Size (KB)': r.size_kb,
      'Uploaded by': r.uploaded_by_name, Uploaded: r.created_date,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 42 }, { wch: 7 }, { wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 9 }, { wch: 18 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Documents')
    XLSX.writeFile(wb, `documents-${today()}.xlsx`)
  }

  // PDF — the register as a filed document, over the shared drawing surface.
  const exportPdf = () => {
    reportsPdf({
      title: 'Document Register',
      subtitle: siteName,
      date: today(),
      stats: [
        { label: 'Documents', value: String(all.length) },
        { label: 'Manuals', value: String(all.filter((d) => d.category === 'Manual').length) },
        { label: 'Drawings', value: String(all.filter((d) => d.document_type === 'DWG').length) },
        { label: 'Certificates', value: String(all.filter((d) => d.category === 'Certificate').length) },
      ],
      sections: [{
        title: `Documents (${rows.length})`,
        columns: [
          { header: 'Document', width: 3.2, value: (r) => r.document_name },
          { header: 'Type', width: 0.8, value: (r) => r.document_type },
          { header: 'Category', width: 1.3, value: (r) => r.category },
          { header: 'Asset', width: 2.6, value: (r) => r.asset_name },
          { header: 'Manufacturer', width: 1.8, value: (r) => r.manufacturer },
          { header: 'Uploaded', width: 1.2, align: 'right', value: (r) => r.created_date },
        ],
        rows,
      }],
    })
  }

  // The representative-manufacturers reference, folded in as the second tab.
  const mfrRows = useMemo(() => {
    const q = mfrSearch.trim().toLowerCase()
    return MANUFACTURERS.filter((m) => !q || [m.classId, m.className, m.manufacturers].join(' ').toLowerCase().includes(q))
  }, [mfrSearch])
  const distinctMfrs = useMemo(() => [...new Set(MANUFACTURERS.flatMap((m) => listOf(m.manufacturers)))].length, [])
  const mfrColumns = [
    { key: 'classId', label: 'Class', render: (m) => <span style={styles.classId}>{m.classId}</span> },
    { key: 'className', label: 'Asset class', render: (m) => <span style={{ fontWeight: 600 }}>{m.className}</span> },
    {
      key: 'manufacturers', label: 'Representative OEMs',
      render: (m) => (
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {listOf(m.manufacturers).map((x) => <span key={x} style={styles.chip}>{x}</span>)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeading
        title="Documents"
        subtitle={tab === 'library'
          ? `Manuals, drawings and certificates, tied to the estate's assets · ${siteName}`
          : 'Representative OEM manufacturers per asset class — the confirmed vendor list agreed at initiation.'}
        right={tab === 'library' ? (
          <>
            <ActionButton onClick={() => setCreating(true)}>Upload document</ActionButton>
            <ActionButton variant="ghost" onClick={exportExcel}>Export Excel</ActionButton>
            <ActionButton variant="ghost" onClick={exportPdf}>Export PDF</ActionButton>
          </>
        ) : null}
      />

      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ ...styles.tab, ...(tab === t.key ? styles.tabOn : null) }}>{t.label}</button>
        ))}
      </div>

      {tab === 'library' ? (
        <>
          <StatCards items={stats} />
          <Toolbar
            search={search} onSearch={setSearch}
            placeholder="Search document, asset, manufacturer, uploader…"
            filters={[
              { label: 'Type', value: type, onChange: setType, options: DOC_TYPES },
              { label: 'Category', value: category, onChange: setCategory, options: DOC_CATEGORIES },
            ]}
            right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
          />
          <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={(r) => openDocument(r, assetOf(r.asset_id))} empty="No documents match these filters." />
        </>
      ) : (
        <>
          <StatCards items={[
            { label: 'Asset classes', value: MANUFACTURERS.length, icon: 'list' },
            { label: 'Representative OEMs', value: distinctMfrs, icon: 'people' },
          ]} />
          <Toolbar
            search={mfrSearch} onSearch={setMfrSearch}
            placeholder="Search asset class or manufacturer…"
            right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{mfrRows.length} shown</span>}
          />
          <DataTable columns={mfrColumns} rows={mfrRows} pageSize={20} empty="No classes match." />
        </>
      )}

      <DocumentUpload
        open={creating}
        onClose={() => setCreating(false)}
        assets={FASM_ASSETS.filter((a) => a._included)}
        categories={DOC_CATEGORIES}
        onCreate={submit}
      />
    </div>
  )
}

const styles = {
  tabs: { display: 'flex', gap: 4, borderBottom: `1px solid ${LINE}`, marginBottom: 16, flexWrap: 'wrap' },
  tab: { padding: '9px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: 'transparent', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', color: MUTE, cursor: 'pointer', marginBottom: -1 },
  tabOn: { color: ACCENT, borderBottomColor: ACCENT },
  classId: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: ACCENT },
  chip: { fontSize: 10.5, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 5, padding: '2px 7px' },
  del: { display: 'inline-flex', padding: 5, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', borderRadius: 6, lineHeight: 0 },
}
