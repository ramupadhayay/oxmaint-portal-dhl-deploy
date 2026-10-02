'use client'

// The Oxmaint portal's UI kit, used as-is.
//
// Both portals are the same product for the same kind of user, and the kit is
// where that shows: a sortable table, a filter bar, a KPI strip, status badges
// that know maintenance vocabulary. Re-exporting rather than copying is what
// keeps a work order looking the same in both, and means a fix to the table is
// a fix in both.

export * from '../../oxmaint/lib/kit'
