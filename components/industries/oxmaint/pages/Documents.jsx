'use client'

// Documents — the maintenance library.
//
// The register lists the paperwork held against every asset: O&M manuals,
// wiring diagrams, calibration and test certificates, commissioning and service
// reports, spare parts lists. A seeded row opens as the document it claims to
// be, drawn from the asset it is filed against.
//
// UPLOAD IS REAL. The form this replaces asked for a file name, picked a type
// from a dropdown and had you type the size in kilobytes — it never took a file.
// Now it takes the file: the type and the size come from it, the bytes are
// stored with the record (and kept out of the bulk load, like a work order's
// attachments), and opening the row opens what was uploaded. A certificate can
// carry the date it stops being valid, which is the date a surveyor checks.
//
// The register exports to PDF and to Excel. A document raised in this portal can
// be deleted and the deletion is on the audit trail; a seeded one cannot, because
// there is no record behind it to remove.

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { useSite } from '../lib/siteStore'
import { managementReportPdf } from '../lib/pdfReports'
import { openDocument, categoryOf } from '../lib/documentPdf'
import { attachmentUrl, downloadUrl } from '../lib/fileEvidence'
import EvidenceUpload from '../components/EvidenceUpload'
import { ASSETS, DOC_CATEGORIES, DOCUMENTS, USER, fmtDate, isPast, daysUntil } from '../lib/data'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'

const { MUTE, ACCENT } = PALETTE

const TYPE_TONE = { PDF: 'red', DWG: 'blue', XLSX: 'green', IMG: 'purple', DOC: 'blue', CSV: 'green' }

const idOf = (r) => r.document_id || r.recordId
const assetIdOf = (a) => a.asset_id || a.recordId

// Files a browser can show on its own open in a tab; the rest download.
const VIEWABLE = new Set(['PDF', 'IMG', 'TXT'])

const stripExt = (name = '') => String(name).replace(/\.[^.]+$/, '')

const blankUpload = () => ({ files: [], name: '', category: 'Certificate', assetId: '', validUntil: '' })

export default function Documents() {
  const { scope, siteName } = useSite()
  const { create, remove, notify, loadBlob } = useStore()
  const [upload, setUpload] = useState(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')

  const merged = useRecords('document', DOCUMENTS, idOf)
  const assets = useRecords('asset', ASSETS, assetIdOf)

  // One category for every row, derived once, so the stat strip, the filter,
  // the column and the viewer can never disagree about what a row is.
  const all = useMemo(
    () => scope(merged).map((d) => ({ ...d, _category: categoryOf(d) })),
    [scope, merged],
  )

  const types = useMemo(() => [...new Set(all.map((d) => d.document_type).filter(Boolean))].sort(), [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => (
      (type === 'all' || d.document_type === type) &&
      (category === 'all' || d._category === category) &&
      (!q || [d.document_name, d.asset_name, d.manufacturer, d.uploaded_by_name, d.fileName].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, type, category])

  // Seeded rows carry a size in KB; uploaded ones carry the file's own bytes.
  const kb = (d) => Number(d.size_kb) || (Number(d.sizeBytes) || 0) / 1024
  const size = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n))} KB`)
  const countOf = (c) => all.filter((d) => d._category === c).length
  const expired = all.filter((d) => d.valid_until && isPast(d.valid_until))

  /**
   * Open a row as what it is.
   *
   * An uploaded file is fetched by id and opened as itself. The tab is opened
   * before the fetch, on the click, because a window opened after an await is a
   * popup as far as the browser is concerned and is blocked.
   */
  const openRow = async (row) => {
    if (row.fileName) {
      const viewable = VIEWABLE.has(row.fileType || row.document_type)
      const tab = viewable && typeof window !== 'undefined' ? window.open('', '_blank') : null
      const full = await loadBlob('document', row.recordId)
      const url = full ? attachmentUrl(full) : null
      if (!url) { tab?.close(); return }
      if (tab) tab.location.href = url
      else downloadUrl(url, row.fileName)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      return
    }
    try {
      await openDocument(row, assets.find((a) => assetIdOf(a) === row.asset_id) || null)
    } catch {
      notify('Could not open that document.', 'error')
    }
  }

  const onDelete = async (row) => {
    if (busy || !row._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete “${row.document_name}”? The deletion is recorded on the audit trail and cannot be undone.`)) return
    setBusy(true)
    try { await remove('document', row.recordId) } finally { setBusy(false) }
  }

  /**
   * Store each picked file as its own document.
   *
   * One at a time, like work-order evidence: each is a multi-megabyte request,
   * and one that fails is named while the others stay saved.
   */
  const saveUpload = async () => {
    const u = upload
    if (!u?.files?.length) return
    const asset = assets.find((a) => assetIdOf(a) === u.assetId) || null
    setBusy(true)
    const failed = []
    let saved = 0
    for (const f of u.files) {
      const name = u.files.length === 1 && u.name.trim() ? u.name.trim() : stripExt(f.fileName)
      const row = await create('document', {
        document_name: name,
        document_type: f.fileType,
        category: u.category,
        asset_id: asset ? assetIdOf(asset) : '',
        asset_name: asset?.asset_name || '',
        asset_type: asset?.asset_type || '',
        manufacturer: asset?.manufacturer || '',
        site_id: asset?.site_id || '',
        fileName: f.fileName,
        mimeType: f.mimeType,
        fileType: f.fileType,
        sizeBytes: f.sizeBytes,
        fileB64: f.fileB64,
        size_kb: Math.max(1, Math.round(f.sizeBytes / 1024)),
        valid_until: u.validUntil || '',
        uploaded_by_name: USER.name,
        created_date: new Date().toISOString(),
      })
      if (row) saved += 1
      else failed.push(f.fileName)
    }
    setBusy(false)
    if (failed.length) notify(`Not uploaded: ${failed.join(', ')}.`, 'error')
    if (saved) {
      notify(`${saved} document${saved === 1 ? '' : 's'} uploaded.`)
      setUpload(null)
    }
  }

  const columns = [
    {
      key: 'document_name', label: 'Document',
      render: (r) => (
        <span style={{ fontWeight: 600, color: ACCENT }}>
          {r.document_name}
          {r.fileName && <span style={{ fontWeight: 400, color: MUTE }}> · {r.fileName}</span>}
        </span>
      ),
    },
    { key: 'document_type', label: 'Type', render: (r) => <StatusBadge tone={TYPE_TONE[r.document_type] || 'grey'}>{r.document_type}</StatusBadge> },
    { key: '_category', label: 'Category' },
    { key: 'asset_name', label: 'Asset', render: (r) => r.asset_name || <span style={{ color: MUTE }}>—</span> },
    { key: 'size_kb', label: 'Size', align: 'right', sortValue: (r) => kb(r), render: (r) => size(kb(r)) },
    {
      key: 'valid_until', label: 'Valid until', sortValue: (r) => r.valid_until || '',
      render: (r) => {
        if (!r.valid_until) return <span style={{ color: MUTE }}>—</span>
        const late = isPast(r.valid_until)
        const soon = !late && daysUntil(r.valid_until) <= 30
        return (
          <span style={{ whiteSpace: 'nowrap', fontWeight: late || soon ? 700 : 500, color: late ? '#b91c1c' : soon ? '#b45309' : undefined }}>
            {fmtDate(r.valid_until)}{late ? ' · expired' : soon ? ' · due' : ''}
          </span>
        )
      },
    },
    { key: 'uploaded_by_name', label: 'Uploaded by' },
    { key: 'created_date', label: 'Uploaded', sortValue: (r) => new Date(r.created_date).getTime(), render: (r) => fmtDate(r.created_date) },
    {
      key: '_del', label: '', align: 'right', sortable: false,
      render: (r) => (r._created ? (
        <button onClick={(e) => { e.stopPropagation(); onDelete(r) }} title="Delete document" style={styles.del}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      ) : <span style={styles.seeded}>—</span>),
    },
  ]

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
        Document: r.document_name, File: r.fileName || '', Type: r.document_type, Category: r._category,
        Asset: r.asset_name, 'Equipment type': r.asset_type || '', Manufacturer: r.manufacturer || '',
        'Size (KB)': Math.round(kb(r)), 'Valid until': r.valid_until ? fmtDate(r.valid_until) : '',
        'Uploaded by': r.uploaded_by_name, Uploaded: fmtDate(r.created_date),
      })))
      ws['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 7 }, { wch: 13 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 13 }, { wch: 18 }, { wch: 13 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Documents')
      XLSX.writeFile(wb, `document-register-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      notify('Could not build the workbook.', 'error')
    }
  }

  const exportPdf = () => managementReportPdf({
    title: 'Document Register',
    subtitle: siteName,
    stats: [
      { label: 'Documents', value: String(all.length) },
      { label: 'Certificates', value: String(countOf('Certificate')) },
      { label: 'Reports', value: String(countOf('Report')) },
      { label: 'Expired', value: String(expired.length) },
    ],
    sections: [{
      title: `Documents (${rows.length})`,
      columns: [
        { header: 'Document', width: 3.2, value: (r) => r.document_name },
        { header: 'Type', width: 0.8, value: (r) => r.document_type },
        { header: 'Category', width: 1.2, value: (r) => r._category },
        { header: 'Asset', width: 2.4, value: (r) => r.asset_name || '-' },
        { header: 'Valid until', width: 1.3, value: (r) => (r.valid_until ? fmtDate(r.valid_until) : '-') },
        { header: 'Uploaded', width: 1.3, align: 'right', value: (r) => fmtDate(r.created_date) },
      ],
      rows,
    }],
  })

  return (
    <div>
      <PageHeader
        icon={sectionIcon('documents', '#15227a')}
        title="Documents"
        subtitle={`Manuals, drawings, certificates and reports · ${siteName}`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionButton variant="ghost" onClick={exportExcel}>Export Excel</ActionButton>
            <ActionButton variant="ghost" onClick={exportPdf}>Export PDF</ActionButton>
            <ActionButton onClick={() => setUpload(blankUpload())}>Upload document</ActionButton>
          </div>
        )}
      />

      <StatStrip items={[
        { label: 'Documents', value: all.length },
        { label: 'Certificates', value: countOf('Certificate') },
        { label: 'Reports', value: countOf('Report') },
        { label: 'Expired certificates', value: expired.length, tone: expired.length ? 'red' : undefined },
        { label: 'Total size', value: size(all.reduce((n, d) => n + kb(d), 0)) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search document, file, asset, manufacturer, uploader…"
        filters={[
          { label: 'Type', value: type, onChange: setType, options: types },
          { label: 'Category', value: category, onChange: setCategory, options: DOC_CATEGORIES },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={openRow} empty="No documents match these filters." />

      <Dialog open={Boolean(upload)} onOpenChange={(o) => { if (!o && !busy) setUpload(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              The file is stored with the record. Its type and size are read from the file itself.
            </DialogDescription>
          </DialogHeader>

          {upload && (
            <div className="space-y-4">
              <EvidenceUpload
                files={upload.files} disabled={busy}
                onChange={(files) => setUpload((u) => ({
                  ...u, files, name: u.name || (files.length === 1 ? stripExt(files[0].fileName) : ''),
                }))}
              />

              {upload.files.length <= 1 && (
                <div>
                  <Label htmlFor="doc-name" className="mb-1 block text-xs text-slate-600">Document name</Label>
                  <Input id="doc-name" className="h-9" placeholder="e.g. Fire pump annual test report"
                    value={upload.name} onChange={(e) => setUpload((u) => ({ ...u, name: e.target.value }))} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="doc-category" className="mb-1 block text-xs text-slate-600">Category</Label>
                  <Select value={upload.category} onValueChange={(v) => setUpload((u) => ({ ...u, category: v }))}>
                    <SelectTrigger id="doc-category" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="doc-valid" className="mb-1 block text-xs text-slate-600">Valid until (optional)</Label>
                  <Input id="doc-valid" type="date" className="h-9"
                    value={upload.validUntil} onChange={(e) => setUpload((u) => ({ ...u, validUntil: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="doc-asset" className="mb-1 block text-xs text-slate-600">Filed against asset (optional)</Label>
                  <Select value={upload.assetId || undefined} onValueChange={(v) => setUpload((u) => ({ ...u, assetId: v }))}>
                    <SelectTrigger id="doc-asset" className="h-9"><SelectValue placeholder="Not filed against an asset" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {assets.map((a) => (
                        <SelectItem key={assetIdOf(a)} value={String(assetIdOf(a))}>
                          {a.asset_name} — {a.asset_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpload(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveUpload} disabled={busy || !upload?.files?.length}>
              {busy ? 'Uploading…' : upload?.files?.length > 1 ? `Upload ${upload.files.length} documents` : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const styles = {
  del: { display: 'inline-flex', padding: 5, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', borderRadius: 6, lineHeight: 0 },
  seeded: { fontSize: 10.5, color: '#cbd5e1' },
}
