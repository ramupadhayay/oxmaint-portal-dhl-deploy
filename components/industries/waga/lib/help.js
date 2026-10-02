// Per-screen help content — the user manual, kept in the app.
//
// The Help button in the corner of every screen reads the entry for the section
// it is on, so a person is only ever shown the guide for what is in front of
// them. Each entry answers four questions in the order somebody actually asks
// them:
//
//   purpose — what is this screen for
//   reads   — what am I looking at (the numbers, columns and badges)
//   steps   — what do I do here
//   next    — where do I go when I am done
//
// `shots` is a capture flow rather than a single picture: successive states of
// the screen, including the dialogs, in the order a user meets them. They are
// generated against the running portal (see the capture script kept with the
// screenshots), so a caption never describes a control that is not on screen.
//
// Keep this in step with the screens. A manual that describes a button which is
// no longer there is worse than no manual, because it is believed.

export const HELP = {
  'getting-started': {
    title: 'Getting Started',
    purpose: 'The landing page after signing in — who you are signed in as, what the trial covers, and one click into every screen of the portal.',
    reads: [
      'The greeting follows your own clock, so a team in another country is greeted correctly for their time of day.',
      'The stat strip is the size of the trial: trial sites, permits, obligations, limits tracked and open deviations.',
      'Each card under "Jump to a section" is one screen, with a line saying what it is for and the group it belongs to.',
    ],
    steps: [
      'Read the strip along the top to see the scale of what is being tracked.',
      'Pick a card under "Jump to a section" to open that screen.',
      'Use "Open the dashboard →" to go straight to the Compliance Overview.',
    ],
    tips: [
      'The same screens are always in the left sidebar; this page is the map, not the only way in.',
      'Your name, department and role are shown in the header on every screen.',
    ],
    next: [
      { label: 'Compliance Overview', section: 'overview', why: 'the standing picture of where the trial is' },
    ],
    shots: [
      { file: 'getting-started-1.jpg', caption: 'The landing page — who is signed in, and what the trial covers' },
      { file: 'getting-started-2.jpg', caption: '"Jump to a section" — every screen of the portal, one click away' },
    ],
  },

  overview: {
    title: 'Compliance Overview',
    purpose: 'Where the trial stands right now: how many permits are held, what they oblige, what falls due next, and what is currently open against you.',
    reads: [
      'Trial sites, Tracked permits and Obligations are the size of the register — what has been imported and is being watched.',
      '"Due in 120 days" is derived from each requirement\'s recurrence rule, not from a completion history — the workbook has none.',
      'Open deviations and Open incidents are what is unresolved; the small line beneath each gives the total ever recorded.',
      '"Upcoming compliance work" lists the next occurrences with their due date, obligation, site and status.',
      '"Permit health" shows each permit\'s expiry with a badge: a day count when a renewal window is near, Active, Renewal submitted, or Non-expiring.',
    ],
    steps: [
      'Read the count strip first — it is the whole trial in six numbers.',
      'Work down "Upcoming compliance work"; anything marked Pending has not been filed in the portal.',
      'Check "Permit health" for a permit inside its renewal window.',
      'Use "Full calendar →" or "All permits →" to open the full register behind either panel.',
    ],
    tips: [
      'Every date here is arithmetic over a recurrence rule. It is a projection of when work is due, not a record that it was done.',
      'The site picker in the header narrows this screen — and every other — to one trial site.',
    ],
    next: [
      { label: 'Compliance Calendar', section: 'calendar', why: 'to work the due list and mark occurrences filed' },
      { label: 'Permits & Licenses', section: 'permits', why: 'to act on a permit that is inside its renewal window' },
    ],
    shots: [
      { file: 'overview-1.jpg', caption: 'The dashboard as it opens — the six headline counts for the trial' },
      { file: 'overview-2.jpg', caption: 'Upcoming compliance work on the left, permit health on the right' },
    ],
  },

  sites: {
    title: 'Sites',
    purpose: 'Every plant this portal covers, where each one sits, and how to add the next one. The scope filter at the top of every screen reads this list.',
    reads: [
      'The cards count the estate: sites, countries, states or regions, legal entities, and the permits and obligations across all of them.',
      'Each row is one plant, with its code, its legal entity, its city and state, and the country it sits in.',
      'The Origin badge is the important one. "From the workbook" means the site was read off the permit documents and verified against them. "Added in the portal" means somebody entered it here — it scopes every screen the same way, but it is not evidence.',
      'A site added in the portal carries no permits or obligations until they are imported for it, and the table shows a dash rather than a zero so the two cannot be confused.',
    ],
    steps: [
      'Press "Add a site" and give it at least a code, a name and a country.',
      'The country is what the scope filter groups by, so it is required — a site without one falls into a bucket called "No country stated".',
      'The new site appears in the header filter immediately, under its own country.',
      'Click any row to scope the whole portal to that site.',
    ],
    tips: [
      'This is what makes the country level useful. With one country in the trial data, selecting it picks the same sites "All trial sites" does; add a plant in another country and the level starts telling you something.',
      'Permits, obligations and limits for a new site are imported from its own permit documents — they are not typed here, for the same reason the workbook is the source of truth for the sites it names.',
    ],
    next: [
      { label: 'Permits & Licenses', section: 'permits', why: 'the authorizations each site holds' },
      { label: 'Reports', section: 'reports', why: 'the estate rolled up by site and by country' },
    ],
    shots: [
      { file: 'sites-1.jpg', caption: 'The estate — which sites came from the workbook, and which were added here' },
      { file: 'sites-2.jpg', caption: '"Add a site" grows the estate, and the country filter with it' },
    ],
  },

  permits: {
    title: 'Permits & Licenses',
    purpose: 'The register of every licence, permit and regulatory authorization held for the trial sites — its validity, its renewal state, and the source document each was read from.',
    reads: [
      'The strip counts what is tracked, what is Active, what has a renewal in progress, what is inside its renewal window, and how many state no expiry.',
      'Each row is one authorization: its permit number and type, site, issuing agency, expiry date and status.',
      'A permit with no expiry in its source shows "Non-expiring" in place of a date — a blank is reproduced as the source left it, never invented.',
      'The status badge is Active, Renewal Submitted, or the day count when expiry is near.',
      'The action on a row depends on its state: Renewal to submit one, Mark received once the agency answers, View / edit for a non-expiring permit.',
    ],
    steps: [
      'Filter with the search box, or narrow by Agency and Status.',
      'On a permit approaching expiry, press "Renewal" and record the application date and the agency\'s confirmation reference.',
      'When the renewed permit arrives, press "Mark received" to record the new expiry and document reference.',
      'Use "New permit" for a licence that was not in the imported workbook.',
    ],
    tips: [
      'A renewal worked here updates the permit\'s status in the portal. The imported workbook is never edited, and every step is written to the audit trail on the Source screen.',
      'Non-expiring permits have no renewal to submit, so they offer View / edit instead.',
    ],
    next: [
      { label: 'Requirements Register', section: 'requirements', why: 'to see what each permit actually obliges you to do' },
      { label: 'Source & Verification', section: 'sources', why: 'to see the document a permit was read from' },
    ],
    shots: [
      { file: 'permits-1.jpg', caption: 'The permit register — each authorization, its agency, expiry and status' },
      { file: 'permits-2.jpg', caption: '"Renewal" on a row records a renewal application against that permit' },
      { file: 'permits-3.jpg', caption: '"New permit" adds a licence that was not in the imported workbook' },
    ],
  },

  requirements: {
    title: 'Requirements Register',
    purpose: 'Every obligation the permits impose, in one register — what has to be done, how often, by when, and which permit clause it comes from.',
    reads: [
      'Each row is one obligation, with the permit and clause it was read from.',
      'The frequency and deadline on a row are what the schedule on the Calendar screen is projected from.',
      'A standing obligation recurs on its own; an event-driven one only applies when its trigger occurs.',
      'The category filter is scoped to what is actually present in the register, so it never offers a category with no rows behind it.',
      '"Last filed" is what has actually been recorded against the obligation, and the "Evidenced" card counts how many of the obligations that can be filed against have been.',
    ],
    steps: [
      'Search or filter to the obligation you are checking.',
      'Read its frequency and deadline — that pair is what generates every occurrence on the calendar.',
      'Press "Record filing" on the row to mark the obligation met, attach the evidence, and note who filed it.',
      'Open the row itself for its full compliance history and every file held against it.',
      'Follow the citation back to the permit it came from.',
    ],
    tips: [
      'This is the largest table in the imported dataset and the part a compliance manager is accountable for; it exists as its own screen for that reason.',
      'An obligation with no date the portal can project — a standing duty, or one triggered by an event — can still be filed against from here. The record then states that the duty was discharged on a day, rather than being measured against a deadline it does not have.',
      'Attached files are held in the portal and can be opened or downloaded again from the obligation record.',
    ],
    next: [
      { label: 'Compliance Calendar', section: 'calendar', why: 'to see these obligations projected into dated occurrences' },
      { label: 'Limits & Monitoring', section: 'parameters', why: 'for the numeric limits an obligation has to stay under' },
    ],
    shots: [
      { file: 'requirements-1.jpg', caption: 'The obligation register — every requirement the permits impose' },
      { file: 'requirements-2.jpg', caption: '"Record filing" marks an obligation met and attaches the evidence for it' },
      { file: 'requirements-3.jpg', caption: 'Each row carries its frequency, deadline and the permit it came from' },
    ],
  },

  calendar: {
    title: 'Compliance Calendar',
    purpose: 'The filing calendar: every obligation projected forward into dated occurrences, and the place a filing is recorded once the work is done.',
    reads: [
      'The strip counts occurrences in the window shown, what is outstanding or overdue, what falls due within 30 days, what has been filed in the portal, and how many rules are being projected.',
      'Each row is one occurrence: its due date and days remaining, the obligation and its type and frequency, the site, who it is submitted to, and its status.',
      'The status badge moves from Due soon to Filed once an occurrence is recorded as met.',
      'The three selects narrow the window, choose between the next occurrence only or all of them, and hide anything already filed.',
    ],
    steps: [
      'Set the window and filters to the work you are looking at.',
      'For an occurrence you have completed, press "Mark filed".',
      'Record the filing date, who filed it, and the evidence reference.',
      'The row moves to Filed; the projected date is kept as it was.',
    ],
    tips: [
      'Every date here is this portal\'s arithmetic over the recurrence rule, not a date WAGA entered. Marking a row filed records that the obligation was met — the projection is never overwritten, and the two are kept apart.',
      'A filing recorded here is written to the audit trail on the Source screen.',
    ],
    next: [
      { label: 'Requirements Register', section: 'requirements', why: 'to check the rule an occurrence was generated from' },
      { label: 'Deviations & CAPA', section: 'deviations', why: 'if an obligation was missed rather than met' },
      { label: 'Reports', section: 'reports', why: 'to export what is outstanding and what has been filed' },
    ],
    shots: [
      { file: 'calendar-1.jpg', caption: 'The generated schedule — occurrences projected from each recurrence rule' },
      { file: 'calendar-2.jpg', caption: '"Mark filed" records who filed an occurrence, when, and against what evidence' },
      { file: 'calendar-3.jpg', caption: 'Further down the schedule — later occurrences and who each is submitted to' },
    ],
  },

  parameters: {
    title: 'Limits & Monitoring',
    purpose: 'The numeric limits the permits impose — emission caps, operating parameters and monitoring thresholds — and the readings logged against them.',
    reads: [
      'Each row is one limit: the parameter, its threshold and unit, the site it applies to, and the most recent reading.',
      'A reading is graded against its limit: In spec, Warning as it approaches the threshold, or Breach once past it.',
      '"None logged" means no reading has been recorded in the portal for that limit yet.',
      '"Where each limit comes from" traces every threshold back to the permit clause that set it.',
    ],
    steps: [
      'Find the parameter you are recording against.',
      'Press "Log reading" and enter the measured value and its date.',
      'The row re-grades itself against the limit and shows the new status.',
      'Read "Where each limit comes from" if you need the clause behind a threshold.',
    ],
    tips: [
      'A limit is only as good as its provenance — every threshold here is carried from the permit, not typed in by hand.',
      'A reading that grades as Breach is the point at which a deviation should be raised.',
    ],
    next: [
      { label: 'Deviations & CAPA', section: 'deviations', why: 'to raise a deviation against a reading in breach' },
      { label: 'Requirements Register', section: 'requirements', why: 'for the monitoring obligation behind a limit' },
    ],
    shots: [
      { file: 'parameters-1.jpg', caption: 'Permit limits and the readings logged against them' },
      { file: 'parameters-2.jpg', caption: '"Log reading" records a measured value against a limit' },
      { file: 'parameters-3.jpg', caption: '"Where each limit comes from" traces every threshold to its permit clause' },
    ],
  },

  deviations: {
    title: 'Deviations & CAPA',
    purpose: 'What went wrong against a permit condition, the investigation into why, and the corrective action worked to close it.',
    reads: [
      'Each row is one deviation: what happened, the permit condition it is against, when it was raised, and whether it is open or closed.',
      'A deviation raised in the portal is marked as such, so it is distinguishable from one carried in from the workbook.',
      'A deviation need not be tied to a single permit — that field can be left as not applicable.',
      'Cause and corrective action are recorded separately, so the investigation and the fix are not conflated.',
    ],
    steps: [
      'Press "Report deviation" and describe what happened and which condition it is against.',
      'It opens as an open deviation — corrective action follows rather than being required up front.',
      'Record the cause once the investigation establishes it.',
      'Record the corrective action, then "Close deviation" when it is complete.',
    ],
    tips: [
      'A deviation is closed by evidence of the corrective action, not by the passage of time.',
      'Open deviations are counted on the Compliance Overview, so anything left open stays visible.',
    ],
    next: [
      { label: 'Compliance Overview', section: 'overview', why: 'open deviations are counted there' },
      { label: 'Source & Verification', section: 'sources', why: 'every change here is written to the audit trail' },
    ],
    shots: [
      { file: 'deviations-1.jpg', caption: 'The deviation register — what went wrong and how it was closed' },
      { file: 'deviations-2.jpg', caption: '"Report deviation" opens a new deviation; corrective action follows it' },
    ],
  },

  safety: {
    title: 'Safety & EHS Overview',
    purpose: 'The WAGA Safety Checklist as a set of digital workflows — what each one covers, and what has been filed against it in the trial.',
    reads: [
      'Each workflow corresponds to a part of the supplied Safety Checklist rather than to something invented for the portal.',
      '"Recommended trial scope" is what is proposed for this trial, and what is deliberately left out of it.',
      '"Checklist structure" shows how the original document is organised, so the digital forms can be matched back to it.',
    ],
    steps: [
      'Read the scope to see which workflows are in the trial.',
      'Open the workflow you need from here or from the Safety & EHS group in the sidebar.',
    ],
    tips: [
      'This screen is the map of the safety module; the work itself is done on the Pre-Task, LOTO, Incident and Training screens.',
    ],
    next: [
      { label: 'Pre-Task Safety / JSA', section: 'pre-task', why: 'the assessment filled in before work starts' },
      { label: 'LOTO / Permit to Work', section: 'loto', why: 'isolation and permit to work' },
    ],
    shots: [
      { file: 'safety-1.jpg', caption: 'The Safety & EHS overview — what the digitised checklist covers' },
      { file: 'safety-2.jpg', caption: 'The recommended trial scope and the checklist\'s own structure' },
    ],
  },

  'pre-task': {
    title: 'Pre-Task Safety / JSA',
    purpose: 'The pre-task safety assessment, completed before work starts: general and emergency information, PPE and training, the hazards of each task step with its control, work authorisation, and the end-of-work review.',
    reads: [
      'The list shows completed assessments, newest first, with who submitted each and when.',
      'The assessment itself follows the supplied checklist section by section rather than being a free-text form.',
      'The task hazard analysis is a repeating row: the task step, the hazard it carries, and the control that makes it safe.',
      'Work authorisation carries signatures, and the end-of-work review is completed after the job rather than before it.',
    ],
    steps: [
      'Press "New assessment" to open the form.',
      'Fill in general and emergency information, then tick the PPE and the training the job requires.',
      'Add a row to the task hazard analysis for each step: task, hazard, control.',
      'Complete work authorisation and sign it, then submit.',
      'After the job, reopen the assessment and complete the end-of-work review.',
    ],
    tips: [
      'This is a digital trial workflow mapped from the supplied WAGA Safety Checklist — the wording follows that document.',
      'An assessment is completed before work starts; the end-of-work review is what closes it afterwards.',
    ],
    next: [
      { label: 'LOTO / Permit to Work', section: 'loto', why: 'if the task needs an energy isolation' },
      { label: 'Training & Compliance', section: 'training', why: 'to check a person holds the training the job requires' },
    ],
    shots: [
      { file: 'pre-task-1.jpg', caption: 'Completed pre-task assessments, newest first' },
      { file: 'pre-task-2.jpg', caption: '"New assessment" opens the JSA — general and emergency information first' },
      { file: 'pre-task-3.jpg', caption: 'The workbook import schema this assessment was mapped from' },
    ],
  },

  loto: {
    title: 'LOTO / Permit to Work',
    purpose: 'Lockout / tagout and permit to work: which energy sources are isolated, who placed and verified the locks, and what has to be true before the isolation is lifted.',
    reads: [
      '"Types of isolation" lists the kinds of energy an isolation can cover.',
      'The lock record is the live list of isolations, with who opened each one and when.',
      'Verification is two separate facts: the devices were checked, and the isolation was tried out — both are recorded, not assumed.',
      'Closeout carries its own checks: re-inert or purge done, and leak test passed.',
    ],
    steps: [
      'Press "Open isolation" and record the manager, date and location of the isolation.',
      'Place the locks and record the devices verified and the try-out result.',
      'If the job crosses shifts, record the manager changeover against the isolation.',
      'At closeout, record the re-inert or purge and the leak test before the isolation is lifted.',
    ],
    tips: [
      'A lock record with no try-out is not a verified isolation — the form keeps them as separate facts for that reason.',
      'The permits to work panel is the paperwork that sits alongside the isolation itself.',
    ],
    next: [
      { label: 'Pre-Task Safety / JSA', section: 'pre-task', why: 'the assessment that identifies the hazards being isolated' },
      { label: 'Incident / RCA', section: 'incidents', why: 'if something went wrong during the work' },
    ],
    shots: [
      { file: 'loto-1.jpg', caption: 'Lock records and permits to work, with their verification state' },
      { file: 'loto-2.jpg', caption: '"Open isolation" places the locks and records who verified them' },
    ],
  },

  incidents: {
    title: 'Incident / RCA',
    purpose: 'Incidents from report to close: what happened, what was done immediately, the root cause, the corrective action, and whether it is OSHA recordable.',
    reads: [
      'Each row is one incident with its occurrence date and current state.',
      'Immediate action is what was done at the time; root cause is what the investigation later established.',
      'OSHA 301 marks an incident as recordable, which is a reporting obligation rather than a severity label.',
    ],
    steps: [
      'Press "Report incident" and record what happened and the immediate action taken.',
      'Press "Start investigation" when the investigation begins.',
      'Record the root cause and the corrective action that follows from it.',
      'Press "Close incident" once the corrective action is complete.',
    ],
    tips: [
      'Recording the immediate action at report time is what separates the response from the investigation.',
      'Open incidents are counted on the Compliance Overview.',
    ],
    next: [
      { label: 'Deviations & CAPA', section: 'deviations', why: 'if the incident also breached a permit condition' },
      { label: 'Training & Compliance', section: 'training', why: 'if the corrective action is a training requirement' },
    ],
    shots: [
      { file: 'incidents-1.jpg', caption: 'The incident register — occurrence, investigation and OSHA recordability' },
      { file: 'incidents-2.jpg', caption: '"Report incident" captures the event and the immediate action taken' },
    ],
  },

  training: {
    title: 'Training & Compliance',
    purpose: 'The training and qualification the trial requires, who has completed it, and which of it is a permit condition rather than a competency gate.',
    reads: [
      'The training matrix is people against required training — the quickest way to see a gap.',
      '"Recorded completions" is the log of what has actually been recorded, with dates.',
      '"Training that is also a permit condition" is the subset a regulator can ask about, which is why it is separated out.',
    ],
    steps: [
      'Read the matrix to find who is missing a required qualification.',
      'Press "Record completion" to log a completed training against a person.',
      'Check the permit-condition list before a filing that depends on it.',
    ],
    tips: [
      'A competency gate is an internal rule; a permit condition is an external obligation. The screen keeps them apart because the consequence of missing them differs.',
    ],
    next: [
      { label: 'Team', section: 'team', why: 'the people this matrix is built from' },
      { label: 'Requirements Register', section: 'requirements', why: 'for the obligation that makes a training a permit condition' },
    ],
    shots: [
      { file: 'training-1.jpg', caption: 'The training matrix — who holds which qualification' },
      { file: 'training-2.jpg', caption: '"Record completion" logs a training against a person' },
      { file: 'training-3.jpg', caption: 'Training that is also a permit condition, listed separately' },
    ],
  },

  reports: {
    title: 'Reports',
    purpose: 'The whole estate rolled up nine ways — by permit, by site, by country, by regulator, by obligation category, by what is due, by what has been filed, by permit limit and by deviation — and taken out of the portal as a PDF for a meeting or a CSV for a spreadsheet.',
    reads: [
      'The cards along the top are the estate at the scope you have chosen in the header. Change the scope and every figure below changes with it.',
      'Each pill is one report. The number on it is how many rows that report has right now.',
      'Under the report name is a line saying what its rows are and where they came from. Read it before quoting a figure out of the table.',
      'A report whose dates the portal worked out for itself carries a "Computed from the rules" badge. Those dates are arithmetic over the recurrence rule on each obligation, not records WAGA entered.',
      'A blank cell says which kind of blank it is. "Not stated in source" means the permit document did not carry the value; "Non-expiring" means the permit genuinely does not expire. They are not the same and the report does not merge them.',
    ],
    steps: [
      'Set the scope you want in the header — all sites, a country, or one site.',
      'Pick a report from the row of pills.',
      'Use "Export this report (CSV)" for a spreadsheet, or "Export this report (PDF)" for the one report on paper.',
      'Use "Full report (PDF)" for every report in one document, with the headline figures on the front page.',
    ],
    tips: [
      'The scope is written into every export, so a file cannot be read out of context later.',
      'The CSV opens directly in Excel and carries the report name, the client, the scope and the date above the header row.',
      'Exports are disabled until the portal has finished loading its records — a report generated too early would under-report what has been filed.',
      'The figures are counted from the register every time. They cannot disagree with the screens they came from.',
    ],
    next: [
      { label: 'Compliance Calendar', section: 'calendar', why: 'to file the occurrences the calendar report lists as outstanding' },
      { label: 'Requirements Register', section: 'requirements', why: 'to record compliance against a specific obligation' },
      { label: 'Source & Verification', section: 'sources', why: 'where each figure was read from, and how it was checked' },
    ],
    shots: [
      { file: 'reports-1.jpg', caption: 'The estate rolled up, with every report one click away' },
      { file: 'reports-2.jpg', caption: 'Each report says what its rows are and where they came from' },
      { file: 'reports-3.jpg', caption: 'Every report exports as a PDF for a meeting or a CSV for a spreadsheet' },
    ],
  },

  team: {
    title: 'Team',
    purpose: 'The people who work this trial and have access to the portal — their department, their access state, and, for an administrator, their credentials.',
    reads: [
      'Each row is one person: name, email, department and access.',
      'Access reads Admin, Active login, or Login pending for somebody who has not been issued credentials yet.',
      'An administrator sees a Password column with a reveal control; a member does not, and the note at the bottom of the screen says which of the two you are.',
    ],
    steps: [
      'Press "Add user" to register a person who works this trial.',
      'Give their name, email and department; credentials are issued separately.',
      'As an administrator, use the reveal control to read a member\'s password when they need it.',
    ],
    tips: [
      'Every member signs in with their own email — the portal is per-user, not a shared login.',
      'Only an administrator can see passwords. The column is not rendered at all for anyone else.',
    ],
    next: [
      { label: 'Training & Compliance', section: 'training', why: 'the qualifications these people hold' },
      { label: 'Getting Started', section: 'getting-started', why: 'what a new member sees when they first sign in' },
    ],
    shots: [
      { file: 'team-1.jpg', caption: 'The people with access to this portal, and their login state' },
      { file: 'team-2.jpg', caption: '"Add user" registers a person who works this trial' },
    ],
  },

  sources: {
    title: 'Source & Verification',
    purpose: 'Where every figure in this portal came from: the source documents, the rules the import followed, the workbook rows carried unmodified, and an append-only log of every check and change.',
    reads: [
      '"Source documents behind the permit register" is the file each permit was read from.',
      '"Rules this import follows" is the workbook README reproduced verbatim — the rules were not paraphrased.',
      '"Workbook task rows carried unmodified" are rows reproduced exactly as supplied, with nothing derived.',
      '"Verification log" and "Activity in this portal" are the append-only audit trail: every check, and every change made in the portal.',
    ],
    steps: [
      'Trace a number you are asked about back to the document it was read from.',
      'Read the import rules if you need to know why a value was carried or left blank.',
      'Check the activity log for what has been recorded in the portal during the trial.',
    ],
    tips: [
      'The audit trail is append-only: entries are added, never edited away. That is what makes it evidence.',
      'Contractual figures come from the client\'s own file. Anything the portal derived is labelled as derived.',
    ],
    next: [
      { label: 'Permits & Licenses', section: 'permits', why: 'the register these documents sit behind' },
      { label: 'Compliance Overview', section: 'overview', why: 'the numbers this screen accounts for' },
    ],
    shots: [
      { file: 'sources-1.jpg', caption: 'The source documents every figure in the portal was read from' },
      { file: 'sources-2.jpg', caption: 'The verification log — an append-only audit trail of every check' },
      { file: 'sources-3.jpg', caption: 'The rules this import follows, and the workbook rows carried unmodified' },
    ],
  },
}

/** Ordered list of sections, for the "complete manual" download. */
export const HELP_ORDER = [
  'getting-started', 'overview', 'sites',
  'permits', 'requirements', 'calendar', 'parameters', 'deviations',
  'safety', 'pre-task', 'loto', 'incidents', 'training',
  'reports', 'team', 'sources',
]

/**
 * The entry for a section. A section with no entry of its own still gets
 * something usable rather than an empty panel — a record route sits under its
 * list section, so falling back to that entry is usually right.
 */
export function helpFor(section) {
  return HELP[section] || HELP.overview
}
