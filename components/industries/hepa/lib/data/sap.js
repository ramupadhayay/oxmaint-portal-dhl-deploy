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


export const SAP_MAPPING = [
  {
    "filterId": "HF-2001",
    "sapEquipmentId": "101000",
    "sapFunctionalLocation": "US-SPK-CR100-HEPA-01",
    "sapWorkOrder": "40005000",
    "workOrderType": "PM04 - Preventive (HEPA Test)",
    "syncStatus": "Synced",
    "lastSync": "2025-07-01",
    "documentRef": "DOC-HF-2001"
  },
  {
    "filterId": "HF-2002",
    "sapEquipmentId": "101001",
    "sapFunctionalLocation": "US-SPK-CR101-HEPA-02",
    "sapWorkOrder": "40005001",
    "workOrderType": "PM01 - Corrective",
    "syncStatus": "Synced",
    "lastSync": "2025-07-04",
    "documentRef": "DOC-HF-2002"
  },
  {
    "filterId": "HF-2003",
    "sapEquipmentId": "101002",
    "sapFunctionalLocation": "US-SPK-CR102-HEPA-03",
    "sapWorkOrder": "40005002",
    "workOrderType": "PM04 - Preventive (Leak Check)",
    "syncStatus": "Synced",
    "lastSync": "2025-07-07",
    "documentRef": "DOC-HF-2003"
  },
  {
    "filterId": "HF-2004",
    "sapEquipmentId": "101003",
    "sapFunctionalLocation": "US-SPK-CR103-HEPA-04",
    "sapWorkOrder": "40005003",
    "workOrderType": "PM02 - Replacement",
    "syncStatus": "Pending",
    "lastSync": "2025-07-10",
    "documentRef": "DOC-HF-2004"
  },
  {
    "filterId": "HF-2005",
    "sapEquipmentId": "101004",
    "sapFunctionalLocation": "US-SPK-CR104-HEPA-05",
    "sapWorkOrder": "40005004",
    "workOrderType": "PM04 - Preventive (HEPA Test)",
    "syncStatus": "Error - Retry Queued",
    "lastSync": "2025-07-13",
    "documentRef": "DOC-HF-2005"
  },
  {
    "filterId": "HF-2006",
    "sapEquipmentId": "101005",
    "sapFunctionalLocation": "US-SPK-CR100-HEPA-06",
    "sapWorkOrder": "40005005",
    "workOrderType": "PM01 - Corrective",
    "syncStatus": "Synced",
    "lastSync": "2025-07-16",
    "documentRef": "DOC-HF-2006"
  },
  {
    "filterId": "HF-2007",
    "sapEquipmentId": "101006",
    "sapFunctionalLocation": "US-SPK-CR101-HEPA-07",
    "sapWorkOrder": "40005006",
    "workOrderType": "PM04 - Preventive (Leak Check)",
    "syncStatus": "Synced",
    "lastSync": "2025-07-19",
    "documentRef": "DOC-HF-2007"
  },
  {
    "filterId": "HF-2008",
    "sapEquipmentId": "101007",
    "sapFunctionalLocation": "US-SPK-CR102-HEPA-08",
    "sapWorkOrder": "40005007",
    "workOrderType": "PM02 - Replacement",
    "syncStatus": "Synced",
    "lastSync": "2025-07-22",
    "documentRef": "DOC-HF-2008"
  },
  {
    "filterId": "HF-2009",
    "sapEquipmentId": "101008",
    "sapFunctionalLocation": "US-SPK-CR103-HEPA-09",
    "sapWorkOrder": "40005008",
    "workOrderType": "PM04 - Preventive (HEPA Test)",
    "syncStatus": "Pending",
    "lastSync": "2025-07-25",
    "documentRef": "DOC-HF-2009"
  },
  {
    "filterId": "HF-2010",
    "sapEquipmentId": "101009",
    "sapFunctionalLocation": "US-SPK-CR104-HEPA-10",
    "sapWorkOrder": "40005009",
    "workOrderType": "PM01 - Corrective",
    "syncStatus": "Error - Retry Queued",
    "lastSync": "2025-07-28",
    "documentRef": "DOC-HF-2010"
  },
  {
    "filterId": "HF-2011",
    "sapEquipmentId": "101010",
    "sapFunctionalLocation": "US-SPK-CR100-HEPA-11",
    "sapWorkOrder": "40005010",
    "workOrderType": "PM04 - Preventive (Leak Check)",
    "syncStatus": "Synced",
    "lastSync": "2025-07-31",
    "documentRef": "DOC-HF-2011"
  },
  {
    "filterId": "HF-2012",
    "sapEquipmentId": "101011",
    "sapFunctionalLocation": "US-SPK-CR101-HEPA-12",
    "sapWorkOrder": "40005011",
    "workOrderType": "PM02 - Replacement",
    "syncStatus": "Synced",
    "lastSync": "2025-08-03",
    "documentRef": "DOC-HF-2012"
  },
  {
    "filterId": "HF-2013",
    "sapEquipmentId": "101012",
    "sapFunctionalLocation": "US-SPK-CR102-HEPA-13",
    "sapWorkOrder": "40005012",
    "workOrderType": "PM04 - Preventive (HEPA Test)",
    "syncStatus": "Synced",
    "lastSync": "2025-08-06",
    "documentRef": "DOC-HF-2013"
  },
  {
    "filterId": "HF-2014",
    "sapEquipmentId": "101013",
    "sapFunctionalLocation": "US-SPK-CR103-HEPA-14",
    "sapWorkOrder": "40005013",
    "workOrderType": "PM01 - Corrective",
    "syncStatus": "Pending",
    "lastSync": "2025-08-09",
    "documentRef": "DOC-HF-2014"
  },
  {
    "filterId": "HF-2015",
    "sapEquipmentId": "101014",
    "sapFunctionalLocation": "US-SPK-CR104-HEPA-15",
    "sapWorkOrder": "40005014",
    "workOrderType": "PM04 - Preventive (Leak Check)",
    "syncStatus": "Error - Retry Queued",
    "lastSync": "2025-08-12",
    "documentRef": "DOC-HF-2015"
  },
  {
    "filterId": "HF-2016",
    "sapEquipmentId": "101015",
    "sapFunctionalLocation": "US-SPK-CR100-HEPA-16",
    "sapWorkOrder": "40005015",
    "workOrderType": "PM02 - Replacement",
    "syncStatus": "Synced",
    "lastSync": "2025-08-15",
    "documentRef": "DOC-HF-2016"
  },
  {
    "filterId": "HF-2017",
    "sapEquipmentId": "101016",
    "sapFunctionalLocation": "US-SPK-CR101-HEPA-17",
    "sapWorkOrder": "40005016",
    "workOrderType": "PM04 - Preventive (HEPA Test)",
    "syncStatus": "Synced",
    "lastSync": "2025-08-18",
    "documentRef": "DOC-HF-2017"
  },
  {
    "filterId": "HF-2018",
    "sapEquipmentId": "101017",
    "sapFunctionalLocation": "US-SPK-CR102-HEPA-18",
    "sapWorkOrder": "40005017",
    "workOrderType": "PM01 - Corrective",
    "syncStatus": "Synced",
    "lastSync": "2025-08-21",
    "documentRef": "DOC-HF-2018"
  }
]
