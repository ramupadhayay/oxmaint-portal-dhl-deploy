'use client'

// Everything this portal can be asked to write down, in one list.
//
// Thirty-eight screens, and three of them take input. That is the right ratio
// for a proof of concept whose subject is supplied data — but it means the
// question "where do I enter something?" has an answer that was, until this
// file, spread across three pages in two different menu groups and phrased
// three different ways on the way in.
//
// So the list lives here, and every affordance reads it: the New menu in the
// header, the Overview's own row of actions, and the button at the top of each
// of the three screens. One entry added here appears in all of them, and none
// of them can drift on the wording.
//
// The order is the order the work happens in. A round is raised against a
// checklist, and a finding on that round becomes a work order — so a reader
// scanning the menu top to bottom is reading the sequence, not an alphabet.

export const CREATE_ACTIONS = [
  {
    key: 'inspection',
    label: 'New inspection',
    href: '/portal/datacenter/inspection-reports/new',
    // What it records, and where it lands. A menu entry that says only its own
    // name makes the reader open it to find out what it was.
    what: 'Work a checklist through against one asset and record the result.',
    lands: 'Inspection Reports',
    icon: 'clipboard',
  },
  {
    key: 'checklist',
    label: 'New checklist',
    href: '/portal/datacenter/checklists/new',
    what: 'Write the round itself — sections, items, and what each item captures.',
    lands: 'Checklist',
    icon: 'list',
  },
  {
    key: 'work-order',
    label: 'New work order',
    href: '/portal/datacenter/work-orders/new',
    what: 'Raise a job against an asset, on its own or from an alert.',
    lands: 'Work Orders',
    icon: 'wrench',
  },
]

// Said once, where the menu ends. A reader who has just been shown three ways
// in is owed the other half of the answer: everything else on these screens is
// the client's own supplied data, and nothing here edits it.
export const READ_ONLY_NOTE =
  'Every other screen is read-only. Nothing here changes the underlying records.'
