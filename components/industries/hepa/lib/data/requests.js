// Maintenance requests already on the register.
//
// The workbook has no request sheet — requests are the thing that happens
// *before* a record exists, so there is nothing to import. But an empty
// register teaches nothing about triage, and "raise one yourself to see it
// work" is a poor answer to "show me how this looks in use".
//
// So these eight are written against conditions the workbook does hold. Every
// one names a filter whose state on the registry actually matches what the
// request describes: HF-2006 really did fail its last integrity test, HF-2001
// really is carrying a pressure breach, HF-2007's replacement really is blocked
// awaiting validation. A request describing a fault the data does not have
// would be caught the first time somebody clicked through to the filter.
//
// The mix is deliberate. Four open and waiting on triage, two already converted
// to work orders, one closed with a reason, one raised against a room rather
// than a filter — which is the case that cannot be converted directly, and the
// one worth having on screen because it is where triage earns its keep.
//
// Dates are relative to the anchor so they move with everything else; see
// ../anchor.js.

export const SEEDED_REQUESTS = [
  {
    requestId: 'REQ-6001',
    filterId: 'HF-2006',
    kind: 'Failed integrity test follow-up',
    urgency: 'Critical',
    detail: 'Scan came back over the limit on the third pass. I stopped and left '
      + 'the room on the interlock rather than re-running it a fourth time.',
    raisedBy: 'J. Okafor',
    raisedRole: 'Technician',
    daysAgo: 2,
    status: 'Open',
  },
  {
    requestId: 'REQ-6002',
    filterId: 'HF-2001',
    kind: 'Pressure differential rising',
    urgency: 'High',
    detail: 'Differential has climbed at each of the last three rounds. Still '
      + 'inside the limit at the moment but it is not coming back down.',
    raisedBy: 'M. Alvarez',
    raisedRole: 'Technician',
    daysAgo: 4,
    status: 'Open',
  },
  {
    requestId: 'REQ-6003',
    filterId: 'HF-2015',
    kind: 'Gasket or seal suspect',
    urgency: 'High',
    detail: 'Gasket is sitting proud on the north corner of the frame. It has not '
      + 'failed a scan but it does not look seated.',
    raisedBy: 'S. Whitfield',
    raisedRole: 'Technician',
    daysAgo: 6,
    status: 'Open',
  },
  {
    // The one that names a room and not a filter. Triage cannot convert it
    // directly, and that refusal is the point of having it here.
    requestId: 'REQ-6004',
    filterId: null,
    cleanroomId: 'CR-204',
    kind: 'Other',
    urgency: 'Medium',
    detail: 'Room takes noticeably longer to come back to pressure after a '
      + 'material transfer than it did last month. Not sure which unit it is.',
    raisedBy: 'D. Okonkwo',
    raisedRole: 'Manufacturing Supervisor',
    daysAgo: 9,
    status: 'Open',
  },
  {
    requestId: 'REQ-6005',
    filterId: 'HF-2007',
    kind: 'Failed integrity test follow-up',
    urgency: 'Critical',
    detail: 'Post-installation scan on the new unit did not pass. Room has not '
      + 'been released and the changeover is sitting open.',
    raisedBy: 'R. Kim',
    raisedRole: 'Technician',
    daysAgo: 14,
    status: 'Converted',
    convertedTo: '40005006',
    convertedBy: 'A. Petrov',
    convertedDaysAgo: 13,
  },
  {
    requestId: 'REQ-6006',
    filterId: 'HF-2003',
    kind: 'Certification due',
    urgency: 'Medium',
    detail: 'Certificate for this one runs out before the next scheduled round. '
      + 'Flagging it so it gets a slot rather than being caught by the escalation.',
    raisedBy: 'L. Nguyen',
    raisedRole: 'Quality Reviewer',
    daysAgo: 18,
    status: 'Converted',
    convertedTo: '40005002',
    convertedBy: 'A. Petrov',
    convertedDaysAgo: 17,
  },
  {
    requestId: 'REQ-6007',
    filterId: 'HF-2011',
    kind: 'Visible damage to filter or frame',
    urgency: 'Low',
    detail: 'Scuff on the outer frame, picked up during the gowning walkthrough.',
    raisedBy: 'D. Castillo',
    raisedRole: 'Technician',
    daysAgo: 21,
    status: 'Rejected',
    rejectionReason: 'Cosmetic mark on the frame housing, outside the seal line. '
      + 'Media and gasket intact, last scan passed. No work needed — logged against the unit.',
    rejectedBy: 'A. Petrov',
    rejectedDaysAgo: 20,
  },
  {
    requestId: 'REQ-6008',
    filterId: 'HF-2002',
    kind: 'Pressure differential rising',
    urgency: 'Medium',
    detail: 'Reading is higher than the rest of the bank on this line. Worth a '
      + 'look before the quarterly comes round.',
    raisedBy: 'J. Okafor',
    raisedRole: 'Technician',
    daysAgo: 27,
    status: 'Open',
  },
]
