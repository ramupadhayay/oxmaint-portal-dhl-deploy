'use client'

// Who can do what.
//
// The brief asks for "role-based access control so Quality, Manufacturing, and
// site leadership see the views relevant to their role without exposing edit
// rights to locked records." The three roles below are not our invention — the
// workbook's own Document Lifecycle sheet routes records to exactly three
// roles, and these are those three, spelled the way the customer spells them.
//
// Two things this deliberately does not do.
//
// It does not hide much. The brief's emphasis is on *edit* rights, and a
// register somebody cannot see is a register they will ask someone else to read
// out to them. So a technician sees the approvals queue and the audit trail;
// what they cannot do is sign. An action that is visible and refused with a
// stated reason teaches the workflow. An action that is invisible teaches
// nothing.
//
// And nobody can edit a locked record. Not the site lead, not whoever is
// holding the laptop. That is the one rule with no role attached to it, because
// a locked record is what the audit package claims is final, and a permission
// that could unlock it would make the claim untrue.

import { createContext, useContext, useMemo, useState } from 'react'

// Each role carries three colours, not one.
//
// `accent` is the ink — the dot, the text, the tick in the matrix. `tint` is
// the pale ground it sits on, and `edge` the border between them. Tinting only
// the background and leaving the product's own accent-coloured text on it is
// how the header avatar came out navy-on-navy and blank: the Quality
// Reviewer's accent *is* the accent, so the two matched exactly.
export const ROLES = [
  {
    id: 'manufacturing',
    name: 'Manufacturing Supervisor',
    short: 'Manufacturing',
    initials: 'MS',
    person: 'D. Okonkwo',
    what: 'Runs the work. Raises requests and orders, completes checklists, records readings.',
    // Deliberately cannot sign: the person who did the work is not the person
    // who accepts it. That separation is the whole point of a review step.
    can: ['raiseWork', 'runChecklist', 'triage', 'viewSap'],
    hidden: ['retention', 'audit-export'],
    accent: '#b45309',
    tint: '#fff7ed',
    edge: '#fed7aa',
  },
  {
    id: 'quality',
    name: 'Quality Reviewer',
    short: 'Quality',
    initials: 'QR',
    person: 'L. Nguyen',
    what: 'Reviews certification records and signs them. Cannot place a legal hold or change routing.',
    can: ['raiseWork', 'runChecklist', 'triage', 'route', 'sign', 'reject', 'export', 'sapPost', 'viewSap'],
    hidden: [],
    accent: '#15227a',
    tint: '#e8ecff',
    edge: '#c7d2fe',
  },
  {
    id: 'lead',
    name: 'Site Quality Lead',
    short: 'Site lead',
    initials: 'AP',
    person: 'A. Petrov',
    what: 'Everything the reviewer can do, plus retention holds, audit packages and the routing rules.',
    can: ['raiseWork', 'runChecklist', 'triage', 'route', 'sign', 'reject', 'export', 'sapPost',
      'viewSap', 'hold', 'configureRouting'],
    hidden: [],
    accent: '#0f766e',
    tint: '#f0fdfa',
    edge: '#99f6e4',
  },
]

export const DEFAULT_ROLE = 'lead'

export const roleById = (id) => ROLES.find((r) => r.id === id) || ROLES.find((r) => r.id === DEFAULT_ROLE)

// Every capability the portal gates on, with the sentence shown when it is
// refused. Written as the reason rather than "permission denied", because the
// reason is the thing worth learning.
export const CAPABILITIES = {
  sign: 'Only Quality can apply an electronic signature. The person who did the work does not accept it.',
  reject: 'Only Quality can return a record to the originator.',
  route: 'Only Quality can route a certification record for review.',
  hold: 'Only the Site Quality Lead can place or lift a legal hold — it suspends a retention clock.',
  export: 'Only Quality can generate an audit package.',
  sapPost: 'Only Quality can confirm a test in SAP. A confirmation says the test is accepted.',
  configureRouting: 'Only the Site Quality Lead can change the routing rules.',
  raiseWork: 'This role cannot raise work.',
  runChecklist: 'This role cannot record a checklist run.',
  triage: 'This role cannot triage a request.',
  viewSap: 'This role cannot see the SAP integration.',
}

const RoleContext = createContext({
  role: roleById(DEFAULT_ROLE),
  setRole: () => {},
  can: () => true,
  why: () => '',
})

export function RoleProvider({ children }) {
  const [id, setId] = useState(DEFAULT_ROLE)
  const role = roleById(id)

  const value = useMemo(() => ({
    role,
    setRole: setId,
    can: (cap) => role.can.includes(cap),
    why: (cap) => CAPABILITIES[cap] || 'This role cannot do that.',
    // Visible to this role at all. See the note at the top: this is a short
    // list on purpose.
    sees: (section) => !role.hidden.includes(section),
  }), [role])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export const useRole = () => useContext(RoleContext)

/**
 * The one rule that belongs to no role.
 *
 * A locked, audit-ready record is what the export package claims is final. If
 * any role could edit it the claim would be untrue, so the check takes the
 * record rather than a capability and answers the same way for everybody.
 */
export const isLocked = (doc) => doc?.stage === 'Locked / Audit-Ready'
export const LOCKED_REASON =
  'This record is locked and audit-ready. Nobody can edit it — that is what the audit package claims about it.'
