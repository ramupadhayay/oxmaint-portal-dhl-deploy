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


export const WORKBOOK_DASHBOARD = [
  {
    "metric": "Total registered filters",
    "value": 18,
    "source": "Filter Asset Registry"
  },
  {
    "metric": "Filters flagged or pending replacement",
    "value": 4,
    "source": "Filter Asset Registry"
  },
  {
    "metric": "Total DOP/PAO tests recorded",
    "value": 36,
    "source": "DOP-PAO Test Records"
  },
  {
    "metric": "DOP/PAO pass rate",
    "value": 0.638888888888889,
    "source": "DOP-PAO Test Records"
  },
  {
    "metric": "Total leak detection readings",
    "value": 54,
    "source": "Leak Detection Records"
  },
  {
    "metric": "Leak readings in breach",
    "value": 19,
    "source": "Leak Detection Records"
  },
  {
    "metric": "Total replacement events",
    "value": 4,
    "source": "Replacement Records"
  },
  {
    "metric": "Replacements blocked (awaiting validation)",
    "value": 1,
    "source": "Replacement Records"
  },
  {
    "metric": "Audit readiness score (pass rate x no-breach rate)",
    "value": 0.414094650205761,
    "source": "Computed"
  }
]
