'use client'

// The Oxmaint portal's UI kit, used as-is.
//
// All three portals are the same product for the same kind of user, and the kit
// is where that shows: a sortable table, a filter bar, status badges, the card
// and section shells. Re-exporting rather than copying is what keeps a table
// looking the same in all three, and means a fix to it is a fix everywhere.

export * from '../../oxmaint/lib/kit'
