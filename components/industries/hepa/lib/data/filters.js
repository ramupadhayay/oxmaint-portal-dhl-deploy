// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-hepa-workbook.mjs from
// data-source/HEPA_Sample_Dataset.xlsx
//
// The workbook describes itself as a SAMPLE / DEMO dataset whose facility
// names, filter IDs and technician names are illustrative. That is carried onto
// the screens as written; it is not ours to soften.
//
// Every value is exactly as authored — not rounded, not reformatted. Dates are
// the one exception: Excel serials become ISO strings, because a serial renders
// as "45444" and reads as a bug. Edit the workbook and re-run
// `npm run import:hepa`.


export const FILTERS = [
  {
    "filterId": "HF-2001",
    "cleanroomId": "CR-101",
    "cleanroomName": "Sterile Fill Line 1",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2001",
    "installDate": "2024-06-01",
    "ageDays": 815,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2002",
    "cleanroomId": "CR-102",
    "cleanroomName": "Sterile Fill Line 2",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2002",
    "installDate": "2024-06-18",
    "ageDays": 798,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2003",
    "cleanroomId": "CR-204",
    "cleanroomName": "Lyophilization Suite A",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2003",
    "installDate": "2024-07-05",
    "ageDays": 781,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2004",
    "cleanroomId": "CR-205",
    "cleanroomName": "Lyophilization Suite B",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2004",
    "installDate": "2024-07-22",
    "ageDays": 764,
    "testInterval": "Semi-Annual",
    "status": "Flagged"
  },
  {
    "filterId": "HF-2005",
    "cleanroomId": "CR-310",
    "cleanroomName": "Gowning / Support Area",
    "isoClass": "ISO 8",
    "qrCode": "QR-HF-2005",
    "installDate": "2024-08-08",
    "ageDays": 747,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2006",
    "cleanroomId": "CR-101",
    "cleanroomName": "Sterile Fill Line 1",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2006",
    "installDate": "2024-08-25",
    "ageDays": 730,
    "testInterval": "Quarterly",
    "status": "Pending Replacement"
  },
  {
    "filterId": "HF-2007",
    "cleanroomId": "CR-102",
    "cleanroomName": "Sterile Fill Line 2",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2007",
    "installDate": "2024-09-11",
    "ageDays": 713,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2008",
    "cleanroomId": "CR-204",
    "cleanroomName": "Lyophilization Suite A",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2008",
    "installDate": "2024-09-28",
    "ageDays": 696,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2009",
    "cleanroomId": "CR-205",
    "cleanroomName": "Lyophilization Suite B",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2009",
    "installDate": "2024-10-15",
    "ageDays": 679,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2010",
    "cleanroomId": "CR-310",
    "cleanroomName": "Gowning / Support Area",
    "isoClass": "ISO 8",
    "qrCode": "QR-HF-2010",
    "installDate": "2024-11-01",
    "ageDays": 662,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2011",
    "cleanroomId": "CR-101",
    "cleanroomName": "Sterile Fill Line 1",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2011",
    "installDate": "2024-11-18",
    "ageDays": 645,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2012",
    "cleanroomId": "CR-102",
    "cleanroomName": "Sterile Fill Line 2",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2012",
    "installDate": "2024-12-05",
    "ageDays": 628,
    "testInterval": "Quarterly",
    "status": "Flagged"
  },
  {
    "filterId": "HF-2013",
    "cleanroomId": "CR-204",
    "cleanroomName": "Lyophilization Suite A",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2013",
    "installDate": "2024-12-22",
    "ageDays": 611,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2014",
    "cleanroomId": "CR-205",
    "cleanroomName": "Lyophilization Suite B",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2014",
    "installDate": "2025-01-08",
    "ageDays": 594,
    "testInterval": "Semi-Annual",
    "status": "Pending Replacement"
  },
  {
    "filterId": "HF-2015",
    "cleanroomId": "CR-310",
    "cleanroomName": "Gowning / Support Area",
    "isoClass": "ISO 8",
    "qrCode": "QR-HF-2015",
    "installDate": "2025-01-25",
    "ageDays": 577,
    "testInterval": "Semi-Annual",
    "status": "Active"
  },
  {
    "filterId": "HF-2016",
    "cleanroomId": "CR-101",
    "cleanroomName": "Sterile Fill Line 1",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2016",
    "installDate": "2025-02-11",
    "ageDays": 560,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2017",
    "cleanroomId": "CR-102",
    "cleanroomName": "Sterile Fill Line 2",
    "isoClass": "ISO 5",
    "qrCode": "QR-HF-2017",
    "installDate": "2025-02-28",
    "ageDays": 543,
    "testInterval": "Quarterly",
    "status": "Active"
  },
  {
    "filterId": "HF-2018",
    "cleanroomId": "CR-204",
    "cleanroomName": "Lyophilization Suite A",
    "isoClass": "ISO 7",
    "qrCode": "QR-HF-2018",
    "installDate": "2025-03-17",
    "ageDays": 526,
    "testInterval": "Semi-Annual",
    "status": "Active"
  }
]

export const THRESHOLDS = {
  "penetration": {
    "label": "Threshold (max penetration %):",
    "value": 0.0001
  },
  "pressureDifferential": {
    "label": "Breach threshold (pressure differential, in. wg):",
    "value": 0.35
  },
  "notificationLeadDays": {
    "label": "Notification lead time (days before due date):",
    "value": 14
  }
}
