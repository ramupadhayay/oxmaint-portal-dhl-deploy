// SAP PM-shaped functional location tree for the CVG GSE sample fleet.
// Labels are derived from the workbook's own zone / shop / type — not a live
// SAP PM extract. Used by the portal asset record and the voice facade.

const TYPE_NODE = {
  'Baggage Tractor': { code: 'TR', label: 'Baggage tractors' },
  'Cargo Tractor / Bobtail': { code: 'CT', label: 'Cargo tractors' },
  'Belt Loader': { code: 'BL', label: 'Belt loaders' },
  'ULD / Pallet Cargo Loader': { code: 'CL', label: 'Cargo loaders' },
  'Pushback Tractor': { code: 'PB', label: 'Pushbacks' },
  'Towbarless Tractor': { code: 'TL', label: 'Towbarless tractors' },
  'Ground Power Unit': { code: 'GPU', label: 'Ground power units' },
  'Air Start Unit': { code: 'ASU', label: 'Air start units' },
  'PCA / Preconditioned Air': { code: 'PCA', label: 'PCA units' },
  'Lavatory Service Truck': { code: 'LAV', label: 'Lavatory trucks' },
  'Potable Water Truck': { code: 'WTR', label: 'Potable water trucks' },
  'Forklift / Pallet Jack Powered': { code: 'FLT', label: 'Forklifts' },
  'Crew / Ramp Vehicle': { code: 'CRW', label: 'Crew vehicles' },
  'Mobile GSE Charger Cart': { code: 'CHG', label: 'Charger carts' },
  'Scissor Lift / Maintenance Stand Powered': { code: 'LFT', label: 'Stands and lifts' },
  'Snow Plow Truck': { code: 'SNW', label: 'Snow equipment' },
  'Deicer Truck': { code: 'DEI', label: 'Deicers' },
  'Snow Blower': { code: 'SNW', label: 'Snow equipment' },
  'Runway Broom': { code: 'SNW', label: 'Snow equipment' },
  'Liquid Deice Trailer': { code: 'DEI', label: 'Deicers' },
}

function shopCode(shop) {
  const s = String(shop || '')
  if (/south/i.test(s)) return { tplnr: 'CVG-GSE-SHOP-S', label: 'GSE Shop South' }
  if (/north/i.test(s)) return { tplnr: 'CVG-GSE-SHOP-N', label: 'GSE Shop North' }
  if (/battery/i.test(s)) return { tplnr: 'CVG-GSE-BATT', label: 'Battery Shop' }
  if (/yard|ramp|uld/i.test(s)) return { tplnr: 'CVG-GSE-YARD', label: 'GSE Yard' }
  return { tplnr: 'CVG-GSE-YARD', label: s || 'GSE Yard' }
}

export function pmHierarchyOf(asset) {
  const type = TYPE_NODE[asset.EquipmentType] || {
    code: String(asset.Class || 'GSE').slice(0, 3).toUpperCase(),
    label: asset.EquipmentType || 'GSE',
  }
  // Prefer the unit's zone so ramp equipment sits under GSE Yard
  // (CVG Superhub → GSE yard → belt loaders → CVG-PWR-0035). Shop stays on
  // the equipment record as the work center.
  const shop = shopCode(asset.LocationZone || asset.AssignedShop)
  const typeTplnr = `CVG-GSE-${type.code}`
  const leaf = asset.FunctLocation || `${typeTplnr}-${String(asset.AssetID || '').slice(-4)}`
  const nodes = [
    { tplnr: 'CVG', label: 'CVG Americas Superhub', level: 0, object_type: 'TPLNR' },
    { tplnr: 'CVG-GSE', label: 'GSE Operations', level: 1, object_type: 'TPLNR' },
    { tplnr: shop.tplnr, label: shop.label, level: 2, object_type: 'TPLNR' },
    { tplnr: typeTplnr, label: type.label, level: 3, object_type: 'TPLNR' },
    { tplnr: leaf, label: asset.AssetID || leaf, level: 4, object_type: 'TPLNR' },
  ]
  return {
    path: nodes.map((n) => n.label),
    path_text: nodes.map((n) => n.label).join(' → '),
    functional_locations: nodes,
    equipment: {
      number: asset.SAPEquipment || '',
      object_type: 'GSE',
      asset_id: asset.AssetID,
      plant: asset.PlanningPlant || 'CVG1',
      work_center: asset.WorkCenter || 'CVGGSE01',
    },
  }
}
