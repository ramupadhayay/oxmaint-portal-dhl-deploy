'use client'

// The department filter.
//
// The other portals filter by site because they are multi-site estates. DNA is
// one plant — 1 Marubeni Dr — with eleven departments inside it, so a site
// picker would be a control with one option. The department is what actually
// changes what a screen is counting here: spinning, weaving, dyeing, FR
// finishing, QC, utilities.
//
// A row with no department is always in scope. Several tables are plant-wide by
// nature — the parts catalogue holds a "General" 3-phase motor that fits
// anything, and the roster's planner and manager sit across all of it — and
// those must not disappear when someone picks the loom shed.

import { createContext, useContext, useMemo, useState } from 'react'
import { departments } from './data'

const DeptContext = createContext({
  dept: 'all', setDept: () => {}, departments, deptName: 'All Departments', scope: (rows) => rows,
})

export function DeptProvider({ children }) {
  const [dept, setDept] = useState('all')

  const value = useMemo(() => ({
    dept,
    setDept,
    departments,
    deptName: dept === 'all'
      ? 'All Departments'
      : (departments.find((d) => d.code === dept)?.name || 'All Departments'),
    /**
     * Filter by whichever field a row names its department with. Work orders and
     * downtime carry `locationCode`, assets carry it too, users carry
     * `department`, parts carry `storeroom` — one function rather than four call
     * sites each remembering which.
     */
    scope: (rows) => {
      if (dept === 'all') return rows
      return rows.filter((r) => {
        const code = r.locationCode ?? r.department ?? r.storeroom ?? r.code
        return !code || code === dept
      })
    },
  }), [dept])

  return <DeptContext.Provider value={value}>{children}</DeptContext.Provider>
}

export const useDept = () => useContext(DeptContext)
