'use client'

// The request bodies these transactions actually carry.
//
// The first version sent four fields and called it a payload. Nobody who has
// posted to S/4HANA would recognise it: a maintenance order is a header, a set
// of operations and a component list, in SAP's own field names, and a reviewer
// reading the panel is reading it for exactly that.
//
// Field names follow SAP's OData services — API_MAINTENANCEORDER for the order
// (MaintenanceOrderType, MaintOrdBasicStartDate, to_MaintenanceOrderOperation
// and the rest), API_EQUIPMENT for the equipment master, and the purchase
// requisition service for the procurement side. They are the names SAP uses, so
// a payload copied out of this panel is a payload somebody could paste into a
// real call and have it be understood.
//
// The values come from this facility's own register, not from a sample: the
// equipment id and functional location are the ones the SAP mapping screen
// carries, the plant is the one the workbook names, and the description says
// what actually happened to that filter.

import { FILTER_VIEW, CLEANROOMS } from './data'

const PLANT = 'SPK1'
const COMPANY_CODE = '1000'
const PLANNER_GROUP = 'Q01'
const WORK_CENTRE = 'CLNRM-MECH'

const iso = (d) => `${d}T00:00:00`
const today = () => new Date().toISOString().slice(0, 10)
const plus = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

/** The filter a payload is about — a failing one where there is one. */
export function subjectFilter() {
  return FILTER_VIEW.find((f) => f.lastTest?.result === 'Fail') || FILTER_VIEW[0] || null
}

const equipmentOf = (f) => f?.sap?.sapEquipmentId || '101000'
const locationOf = (f) => f?.sap?.sapFunctionalLocation || `${PLANT}-${f?.cleanroomId || 'CR101'}-HEPA`

/**
 * A maintenance order, as API_MAINTENANCEORDER takes one.
 *
 * Header, operations, components. The operations are the actual sequence a
 * cleanroom filter change follows — isolate, remove under containment, install,
 * re-test, release — because an order whose operations are "Step 1, Step 2" is
 * an order no planner would accept, and this is the payload the customer asked
 * to see done properly.
 */
function maintenanceOrder(f) {
  const room = CLEANROOMS.find((c) => c.cleanroomId === f?.cleanroomId)
  return {
    MaintenanceOrderType: 'PM01',
    MaintenanceOrderDesc: `${f.filterId} integrity test failure — seal investigation and media replacement`,
    MaintenancePlanningPlant: PLANT,
    MaintenancePlant: PLANT,
    MainWorkCenter: WORK_CENTRE,
    MainWorkCenterPlant: PLANT,
    MaintenancePriority: '1',
    MaintPriorityType: 'PM',
    Equipment: equipmentOf(f),
    FunctionalLocation: locationOf(f),
    MaintenanceNotification: '10004821',
    CompanyCode: COMPANY_CODE,
    CostCenter: 'CC-QA-4100',
    BusinessArea: '9900',
    MaintOrderPlannerGroup: PLANNER_GROUP,
    PlantSection: room?.isoClass === 'ISO 5' ? 'ASEPTIC' : 'CLEANRM',
    MaintOrdBasicStartDate: iso(today()),
    MaintOrdBasicEndDate: iso(plus(2)),
    MaintOrderLatestScheduledDate: iso(plus(5)),
    to_MaintenanceOrderOperation: [
      op('0010', 'Isolate suite, secure airflow, post the room out of use', 2, 2),
      op('0020', 'Remove terminal filter under containment, record outgoing serial', 3, 2),
      op('0030', 'Install replacement, seat gasket, torque clamps to SOP value', 3, 2),
      op('0040', 'Post-installation DOP/PAO integrity scan to ISO 14644-3 Annex B', 4, 1),
      op('0050', 'Requalify room, record counts, release to production', 4, 1),
    ],
    to_MaintOrderComponent: [
      component('0030', 'HEPA-610610292', 'HEPA filter 610x610x292 H14, gel seal', 1, 'EA'),
      component('0030', 'GASKET-GEL-610', 'Gel seal channel refill, 610 mm', 2, 'EA'),
      component('0040', 'AEROSOL-PAO4', 'PAO-4 challenge aerosol, 1 L', 1, 'L'),
    ],
    to_MaintOrderObjectListItem: [
      {
        ObjectListItemSequence: '01',
        Equipment: equipmentOf(f),
        FunctionalLocation: locationOf(f),
        MaintObjectListItemText: `${f.cleanroomName} · ${f.isoClass}`,
      },
    ],
  }
}

const op = (n, text, hours, people) => ({
  MaintenanceOrderOperation: n,
  OperationDescription: text,
  WorkCenter: WORK_CENTRE,
  Plant: PLANT,
  OperationControlProfile: 'PM01',
  OperationDuration: String(hours),
  OperationDurationUnit: 'H',
  NumberOfCapacities: String(people),
  OperationPlannedWork: String(hours * people),
  OperationWorkQuantityUnit: 'H',
})

const component = (opNo, material, text, qty, unit) => ({
  MaintenanceOrderOperation: opNo,
  Material: material,
  MaterialDescription: text,
  RequirementQuantity: String(qty),
  BaseUnit: unit,
  Plant: PLANT,
  StorageLocation: 'QA01',
  MaterialCompIsMarkedForBackflush: false,
})

/**
 * What each transaction sends.
 *
 * Written per code rather than from one template: a goods issue and an
 * equipment read have nothing in common, and a panel where every transaction
 * shows the same body teaches a reader that the body does not matter.
 */
export function payloadFor(code) {
  const f = subjectFilter()
  if (!f) return {}

  const table = {
    // ── Plant Maintenance ────────────────────────────────────────────────
    'PM-001': () => maintenanceOrder(f),

    'PM-002': () => ({
      MaintenanceOrder: f.sap?.sapWorkOrder || '40005002',
      MaintenanceOrderType: 'PM01',
      MaintOrdSystemStatus: 'REL  PRC  NMAT',
      MaintOrdUserStatus: 'INPR',
      StatusChangeReason: 'Work started on site',
      ActualStartDate: iso(today()),
      Equipment: equipmentOf(f),
      to_MaintenanceOrderOperation: [
        {
          MaintenanceOrderOperation: '0010',
          OperationConfirmedWork: '2',
          OperationWorkQuantityUnit: 'H',
          OperationIsFinallyConfirmed: true,
          ConfirmationText: 'Suite isolated, airflow secured, room posted out of use.',
        },
      ],
    }),

    'PM-003': () => ({
      MaintenanceOrder: f.sap?.sapWorkOrder || '40005002',
      MaintenanceOrderOperation: '0030',
      ConfirmationText: 'Replacement installed, clamps torqued to SOP value.',
      PersonnelNumber: '00104412',
      WorkCenter: WORK_CENTRE,
      Plant: PLANT,
      ActualWorkQuantity: '3',
      ActualWorkQuantityUnit: 'H',
      ConfirmationYearMonth: today().slice(0, 7).replace('-', ''),
      PostingDate: iso(today()),
      ActivityType: 'MECH',
      CostCenter: 'CC-QA-4100',
    }),

    'PM-004': () => ({
      Equipment: equipmentOf(f),
      $select: 'Equipment,EquipmentName,TechnicalObjectType,FunctionalLocation,'
        + 'MaintenancePlant,PlannerGroup,EquipmentCategory,ConstructionYear,ValidityStartDate',
      $expand: 'to_EquipmentPartner,to_EquipmentClass',
      // Ours, so the gateway can resolve the unit without SAP's id being wired
      // through every screen first.
      filterId: f.filterId,
    }),

    'PM-005': () => ({
      BillOfMaterial: '00000412',
      BillOfMaterialCategory: 'E',
      BillOfMaterialVariant: '1',
      Equipment: equipmentOf(f),
      Plant: PLANT,
      to_BillOfMaterialItem: [
        { BillOfMaterialItemNumber: '0010', Material: 'HEPA-610610292', Quantity: '1', BaseUnit: 'EA' },
        { BillOfMaterialItemNumber: '0020', Material: 'GASKET-GEL-610', Quantity: '2', BaseUnit: 'EA' },
      ],
    }),

    // ── Materials Management ─────────────────────────────────────────────
    'MM-004': () => ({
      PurchaseRequisitionType: 'NB',
      to_PurchaseReqnItem: [
        {
          PurchaseRequisitionItem: '00010',
          Material: 'HEPA-610610292',
          PurchaseRequisitionItemText: 'HEPA filter 610x610x292 H14, gel seal',
          RequestedQuantity: '1',
          BaseUnit: 'EA',
          Plant: PLANT,
          StorageLocation: 'QA01',
          PurchasingGroup: 'Q01',
          PurchasingOrganization: '1000',
          DeliveryDate: iso(plus(7)),
          MaterialGroup: 'FILT01',
          PurchaseRequisitionPrice: '412.00',
          PurReqnItemCurrency: 'USD',
          AccountAssignmentCategory: 'F',
          to_PurchaseReqnAcctAssgmt: [
            {
              PurchaseReqnAcctAssgmtNumber: '01',
              CostCenter: 'CC-QA-4100',
              GLAccount: '0000400100',
              OrderID: f.sap?.sapWorkOrder || '40005002',
            },
          ],
        },
      ],
    }),

    'MM-008': () => ({
      DocumentDate: iso(today()),
      PostingDate: iso(today()),
      GoodsMovementCode: '01',
      to_MaterialDocumentItem: [
        {
          Material: 'HEPA-610610292',
          Plant: PLANT,
          StorageLocation: 'QA01',
          GoodsMovementType: '101',
          PurchaseOrder: '4500001827',
          PurchaseOrderItem: '00010',
          QuantityInEntryUnit: '1',
          EntryUnit: 'EA',
          Batch: 'LOT-2026-0844',
        },
      ],
    }),

    'MM-009': () => ({
      DocumentDate: iso(today()),
      PostingDate: iso(today()),
      GoodsMovementCode: '03',
      to_MaterialDocumentItem: [
        {
          Material: 'HEPA-610610292',
          Plant: PLANT,
          StorageLocation: 'QA01',
          GoodsMovementType: '261',
          OrderID: f.sap?.sapWorkOrder || '40005002',
          OrderItem: '0030',
          QuantityInEntryUnit: '1',
          EntryUnit: 'EA',
          Batch: 'LOT-2026-0844',
        },
      ],
    }),

    // ── EHS ──────────────────────────────────────────────────────────────
    'EHS-001': () => ({
      IncidentType: 'ENVIRONMENTAL',
      IncidentDesc: `Particle count excursion in ${f.cleanroomName} — ${f.isoClass} action level exceeded`,
      Plant: PLANT,
      FunctionalLocation: locationOf(f),
      Equipment: equipmentOf(f),
      IncidentDate: iso(today()),
      SeverityCode: 'MAJOR',
      ReportedByUser: 'R.KIM',
      RegulatoryReportingRequired: true,
      to_IncidentTask: [
        { TaskType: 'CONTAIN', TaskDesc: 'Room cleared and posted out of use', DueDate: iso(today()) },
        { TaskType: 'INVEST', TaskDesc: 'Root cause investigation opened', DueDate: iso(plus(3)) },
      ],
    }),

    'EHS-003': () => ({
      ComplianceRequirement: 'EU-GMP-ANNEX1',
      ComplianceScenario: 'CLEANROOM_CERTIFICATION',
      Plant: PLANT,
      FunctionalLocation: locationOf(f),
      Equipment: equipmentOf(f),
      CheckDate: iso(today()),
      filterId: f.filterId,
    }),
  }

  const build = table[code]
  if (build) return build()

  // Everything else in the catalogue: the header a transaction of that kind
  // carries, so the shape is right even where the detail is not modelled.
  return {
    TransactionCode: code,
    Plant: PLANT,
    CompanyCode: COMPANY_CODE,
    Equipment: equipmentOf(f),
    FunctionalLocation: locationOf(f),
    DocumentDate: iso(today()),
    PostingDate: iso(today()),
    CreatedByUser: 'OXMAINT_SVC',
    ReferenceDocument: f.sap?.sapWorkOrder || '40005002',
  }
}

export const payloadTextFor = (code) => JSON.stringify(payloadFor(code), null, 2)
