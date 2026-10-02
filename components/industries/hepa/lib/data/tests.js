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


export const TESTS = [
  {
    "testId": "DT-3001",
    "filterId": "HF-2001",
    "testDate": "2025-02-12",
    "testPoints": 12,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3002",
    "filterId": "HF-2001",
    "testDate": "2025-02-23",
    "testPoints": 20,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3003",
    "filterId": "HF-2002",
    "testDate": "2025-03-06",
    "testPoints": 12,
    "penetration": 0.00008,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3004",
    "filterId": "HF-2002",
    "testDate": "2025-03-17",
    "testPoints": 12,
    "penetration": 0.00006,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3005",
    "filterId": "HF-2003",
    "testDate": "2025-03-28",
    "testPoints": 12,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3006",
    "filterId": "HF-2003",
    "testDate": "2025-04-08",
    "testPoints": 20,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3007",
    "filterId": "HF-2004",
    "testDate": "2025-04-19",
    "testPoints": 12,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3008",
    "filterId": "HF-2004",
    "testDate": "2025-04-30",
    "testPoints": 16,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3009",
    "filterId": "HF-2005",
    "testDate": "2025-05-11",
    "testPoints": 12,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3010",
    "filterId": "HF-2005",
    "testDate": "2025-05-22",
    "testPoints": 12,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3011",
    "filterId": "HF-2006",
    "testDate": "2025-06-02",
    "testPoints": 20,
    "penetration": 0.00006,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3012",
    "filterId": "HF-2006",
    "testDate": "2025-06-13",
    "testPoints": 12,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3013",
    "filterId": "HF-2007",
    "testDate": "2025-06-24",
    "testPoints": 12,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3014",
    "filterId": "HF-2007",
    "testDate": "2025-07-05",
    "testPoints": 20,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3015",
    "filterId": "HF-2008",
    "testDate": "2025-07-16",
    "testPoints": 20,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3016",
    "filterId": "HF-2008",
    "testDate": "2025-07-27",
    "testPoints": 12,
    "penetration": 0.00009,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3017",
    "filterId": "HF-2009",
    "testDate": "2025-08-07",
    "testPoints": 20,
    "penetration": 0.00009,
    "result": "Pass",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3018",
    "filterId": "HF-2009",
    "testDate": "2025-08-18",
    "testPoints": 12,
    "penetration": 0.00008,
    "result": "Pass",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3019",
    "filterId": "HF-2010",
    "testDate": "2025-08-29",
    "testPoints": 20,
    "penetration": 0.00006,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3020",
    "filterId": "HF-2010",
    "testDate": "2025-09-09",
    "testPoints": 16,
    "penetration": 0.00009,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3021",
    "filterId": "HF-2011",
    "testDate": "2025-09-20",
    "testPoints": 12,
    "penetration": 0.00008,
    "result": "Pass",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3022",
    "filterId": "HF-2011",
    "testDate": "2025-10-01",
    "testPoints": 16,
    "penetration": 0.00006,
    "result": "Pass",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3023",
    "filterId": "HF-2012",
    "testDate": "2025-10-12",
    "testPoints": 12,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3024",
    "filterId": "HF-2012",
    "testDate": "2025-10-23",
    "testPoints": 12,
    "penetration": 0.00009,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3025",
    "filterId": "HF-2013",
    "testDate": "2025-11-03",
    "testPoints": 16,
    "penetration": 0.00008,
    "result": "Pass",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3026",
    "filterId": "HF-2013",
    "testDate": "2025-11-14",
    "testPoints": 16,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3027",
    "filterId": "HF-2014",
    "testDate": "2025-11-25",
    "testPoints": 20,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3028",
    "filterId": "HF-2014",
    "testDate": "2025-02-09",
    "testPoints": 20,
    "penetration": 0.00009,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3029",
    "filterId": "HF-2015",
    "testDate": "2025-02-20",
    "testPoints": 16,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3030",
    "filterId": "HF-2015",
    "testDate": "2025-03-03",
    "testPoints": 20,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3031",
    "filterId": "HF-2016",
    "testDate": "2025-03-14",
    "testPoints": 20,
    "penetration": 0.00008,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3032",
    "filterId": "HF-2016",
    "testDate": "2025-03-25",
    "testPoints": 16,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3033",
    "filterId": "HF-2017",
    "testDate": "2025-04-05",
    "testPoints": 12,
    "penetration": 0.00012,
    "result": "Fail",
    "technicianId": "T-102",
    "technicianName": "J. Okafor",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3034",
    "filterId": "HF-2017",
    "testDate": "2025-04-16",
    "testPoints": 12,
    "penetration": 0.00015,
    "result": "Fail",
    "technicianId": "T-103",
    "technicianName": "R. Kim",
    "lockStatus": "Locked - Flagged"
  },
  {
    "testId": "DT-3035",
    "filterId": "HF-2018",
    "testDate": "2025-04-27",
    "testPoints": 20,
    "penetration": 0.00004,
    "result": "Pass",
    "technicianId": "T-104",
    "technicianName": "S. Whitfield",
    "lockStatus": "Locked"
  },
  {
    "testId": "DT-3036",
    "filterId": "HF-2018",
    "testDate": "2025-05-08",
    "testPoints": 16,
    "penetration": 0.00006,
    "result": "Pass",
    "technicianId": "T-101",
    "technicianName": "M. Alvarez",
    "lockStatus": "Locked"
  }
]

export const LEAKS = [
  {
    "readingId": "LR-4001",
    "filterId": "HF-2001",
    "readingDate": "2025-03-10",
    "pressureDifferential": 0.18,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4002",
    "filterId": "HF-2001",
    "readingDate": "2025-03-19",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4003",
    "filterId": "HF-2001",
    "readingDate": "2025-03-28",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4004",
    "filterId": "HF-2002",
    "readingDate": "2025-04-06",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4005",
    "filterId": "HF-2002",
    "readingDate": "2025-04-15",
    "pressureDifferential": 0.18,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4006",
    "filterId": "HF-2002",
    "readingDate": "2025-04-24",
    "pressureDifferential": 0.28,
    "readingType": "Alert-Triggered",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4007",
    "filterId": "HF-2003",
    "readingDate": "2025-05-03",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4008",
    "filterId": "HF-2003",
    "readingDate": "2025-05-12",
    "pressureDifferential": 0.28,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4009",
    "filterId": "HF-2003",
    "readingDate": "2025-05-21",
    "pressureDifferential": 0.37,
    "readingType": "Alert-Triggered",
    "technicianId": "T-102",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4010",
    "filterId": "HF-2004",
    "readingDate": "2025-05-30",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4011",
    "filterId": "HF-2004",
    "readingDate": "2025-06-08",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4012",
    "filterId": "HF-2004",
    "readingDate": "2025-06-17",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4013",
    "filterId": "HF-2005",
    "readingDate": "2025-06-26",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4014",
    "filterId": "HF-2005",
    "readingDate": "2025-07-05",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4015",
    "filterId": "HF-2005",
    "readingDate": "2025-07-14",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4016",
    "filterId": "HF-2006",
    "readingDate": "2025-07-23",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4017",
    "filterId": "HF-2006",
    "readingDate": "2025-08-01",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4018",
    "filterId": "HF-2006",
    "readingDate": "2025-08-10",
    "pressureDifferential": 0.37,
    "readingType": "Alert-Triggered",
    "technicianId": "T-103",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4019",
    "filterId": "HF-2007",
    "readingDate": "2025-08-19",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4020",
    "filterId": "HF-2007",
    "readingDate": "2025-08-28",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4021",
    "filterId": "HF-2007",
    "readingDate": "2025-09-06",
    "pressureDifferential": 0.18,
    "readingType": "Alert-Triggered",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4022",
    "filterId": "HF-2008",
    "readingDate": "2025-09-15",
    "pressureDifferential": 0.31,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4023",
    "filterId": "HF-2008",
    "readingDate": "2025-09-24",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4024",
    "filterId": "HF-2008",
    "readingDate": "2025-10-03",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4025",
    "filterId": "HF-2009",
    "readingDate": "2025-10-12",
    "pressureDifferential": 0.31,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4026",
    "filterId": "HF-2009",
    "readingDate": "2025-10-21",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4027",
    "filterId": "HF-2009",
    "readingDate": "2025-10-30",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4028",
    "filterId": "HF-2010",
    "readingDate": "2025-03-03",
    "pressureDifferential": 0.22,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4029",
    "filterId": "HF-2010",
    "readingDate": "2025-03-12",
    "pressureDifferential": 0.28,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4030",
    "filterId": "HF-2010",
    "readingDate": "2025-03-21",
    "pressureDifferential": 0.28,
    "readingType": "Alert-Triggered",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4031",
    "filterId": "HF-2011",
    "readingDate": "2025-03-30",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4032",
    "filterId": "HF-2011",
    "readingDate": "2025-04-08",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4033",
    "filterId": "HF-2011",
    "readingDate": "2025-04-17",
    "pressureDifferential": 0.37,
    "readingType": "Alert-Triggered",
    "technicianId": "T-102",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4034",
    "filterId": "HF-2012",
    "readingDate": "2025-04-26",
    "pressureDifferential": 0.31,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4035",
    "filterId": "HF-2012",
    "readingDate": "2025-05-05",
    "pressureDifferential": 0.22,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4036",
    "filterId": "HF-2012",
    "readingDate": "2025-05-14",
    "pressureDifferential": 0.37,
    "readingType": "Alert-Triggered",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4037",
    "filterId": "HF-2013",
    "readingDate": "2025-05-23",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4038",
    "filterId": "HF-2013",
    "readingDate": "2025-06-01",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4039",
    "filterId": "HF-2013",
    "readingDate": "2025-06-10",
    "pressureDifferential": 0.4,
    "readingType": "Alert-Triggered",
    "technicianId": "T-104",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4040",
    "filterId": "HF-2014",
    "readingDate": "2025-06-19",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4041",
    "filterId": "HF-2014",
    "readingDate": "2025-06-28",
    "pressureDifferential": 0.18,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4042",
    "filterId": "HF-2014",
    "readingDate": "2025-07-07",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4043",
    "filterId": "HF-2015",
    "readingDate": "2025-07-16",
    "pressureDifferential": 0.4,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4044",
    "filterId": "HF-2015",
    "readingDate": "2025-07-25",
    "pressureDifferential": 0.18,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4045",
    "filterId": "HF-2015",
    "readingDate": "2025-08-03",
    "pressureDifferential": 0.4,
    "readingType": "Alert-Triggered",
    "technicianId": "T-102",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4046",
    "filterId": "HF-2016",
    "readingDate": "2025-08-12",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4047",
    "filterId": "HF-2016",
    "readingDate": "2025-08-21",
    "pressureDifferential": 0.28,
    "readingType": "Scheduled",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4048",
    "filterId": "HF-2016",
    "readingDate": "2025-08-30",
    "pressureDifferential": 0.25,
    "readingType": "Alert-Triggered",
    "technicianId": "T-101",
    "breach": "OK"
  },
  {
    "readingId": "LR-4049",
    "filterId": "HF-2017",
    "readingDate": "2025-09-08",
    "pressureDifferential": 0.18,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4050",
    "filterId": "HF-2017",
    "readingDate": "2025-09-17",
    "pressureDifferential": 0.22,
    "readingType": "Scheduled",
    "technicianId": "T-103",
    "breach": "OK"
  },
  {
    "readingId": "LR-4051",
    "filterId": "HF-2017",
    "readingDate": "2025-09-26",
    "pressureDifferential": 0.31,
    "readingType": "Alert-Triggered",
    "technicianId": "T-104",
    "breach": "OK"
  },
  {
    "readingId": "LR-4052",
    "filterId": "HF-2018",
    "readingDate": "2025-10-05",
    "pressureDifferential": 0.37,
    "readingType": "Scheduled",
    "technicianId": "T-101",
    "breach": "Breach"
  },
  {
    "readingId": "LR-4053",
    "filterId": "HF-2018",
    "readingDate": "2025-10-14",
    "pressureDifferential": 0.25,
    "readingType": "Scheduled",
    "technicianId": "T-102",
    "breach": "OK"
  },
  {
    "readingId": "LR-4054",
    "filterId": "HF-2018",
    "readingDate": "2025-10-23",
    "pressureDifferential": 0.22,
    "readingType": "Alert-Triggered",
    "technicianId": "T-103",
    "breach": "OK"
  }
]
