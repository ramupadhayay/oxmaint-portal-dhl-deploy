'use client'

// The checklist builder's chrome, which now lives in the general CMMS portal.
//
// It holds no data and nothing about any one customer — a dialog, a panel, a
// labelled field, a picker, a toggle. The general portal wanted the same
// builder, so rather than a second copy that drifts, the kit moved to the
// portal that is the product and this re-exports it under the path the
// pharmaceutical portal's screens already import.

export * from '../../oxmaint/lib/checklistKit'
