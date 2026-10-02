'use client'

// Paging for the card and list registers.
//
// The work order and PM schedule screens rendered every row they held. On a
// generated plant of ninety jobs that went unnoticed; on DHL's dataset — 631 work
// orders in the live year — the Work Orders page came back as 5.2 MB of HTML and
// took seven seconds to draw, which over a tunnel in front of an evaluator is a
// page that looks broken. The tables already paged; the card lists did not.
//
// A hook and a bar rather than a wrapper component, so each screen keeps its own
// markup and only the slice it maps over changes.

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'

/**
 * @param items     the full, already-filtered list
 * @param pageSize  rows per page
 * @param resetKey  any value that changes when the filters do — the list goes
 *                  back to page one, because page seven of a new filter is
 *                  usually empty and always confusing
 */
export function usePaged(items, pageSize = 25, resetKey = '') {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [resetKey])

  const total = items.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  // Clamped, so a delete that empties the last page does not strand the reader
  // on a page that no longer exists.
  const current = Math.min(page, pages)
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  )
  return {
    page: current,
    pages,
    total,
    from: total ? (current - 1) * pageSize + 1 : 0,
    to: Math.min(total, current * pageSize),
    pageItems,
    setPage,
  }
}

// Which page numbers to show: the first, the last, and two either side of the
// current one, with gaps marked. Twenty-six buttons is a row nobody reads.
function windowOf(page, pages) {
  const want = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])
  const list = [...want].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out = []
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1) out.push(`gap-${n}`)
    out.push(n)
  })
  return out
}

export default function PagerBar({ page, pages, total, from, to, setPage, noun = 'items' }) {
  if (total === 0) return null
  const go = (n) => {
    setPage(n)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-slate-500 tabular-nums">
        Showing {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {total.toLocaleString('en-US')} {noun}
      </p>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {windowOf(page, pages).map((n) => (typeof n === 'string'
            ? <span key={n} className="px-1 text-sm text-slate-400">…</span>
            : (
              <Button
                key={n} size="sm" variant={n === page ? 'default' : 'ghost'}
                className="h-8 min-w-8 px-2 tabular-nums"
                aria-current={n === page ? 'page' : undefined}
                onClick={() => go(n)}
              >
                {n}
              </Button>
            )))}
          <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page >= pages} onClick={() => go(page + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  )
}
