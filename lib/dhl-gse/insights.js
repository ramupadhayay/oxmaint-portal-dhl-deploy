/**
 * Current-period workmanship and spare-variant answers for voice / MCP.
 *
 * Computed from the seeded voice register — not a live airline quality extract.
 */

import { DEMO_TECH } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume'
import {
  QUALITY_HONESTY,
  computeSpareInsights,
  computeWorkmanship,
} from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceInsights'
import { getVoiceRegister } from './register.js'

export function getWorkmanshipReport({ tech_id, own_only } = {}) {
  const reg = getVoiceRegister()
  const report = reg.voiceInsights?.workmanship || computeWorkmanship(reg.workOrders || [])
  const wanted = String(tech_id || '').trim()
  if (own_only || wanted) {
    const key = wanted || DEMO_TECH.tech_id
    const row = (report.technicians || []).find((t) => t.tech_id === key)
      || (report.shop_sample || []).find((t) => t.tech_id === key)
    if (!row) {
      return {
        ok: false,
        error: `No current-period workmanship row for ${key}.`,
        honesty: QUALITY_HONESTY,
      }
    }
    return {
      ok: true,
      honesty: QUALITY_HONESTY,
      technician: row,
      how_to_read: report.how_to_read,
      windows_days: report.windows_days,
    }
  }
  return {
    ok: true,
    honesty: QUALITY_HONESTY,
    windows_days: report.windows_days,
    technicians: report.technicians,
    shop_sample: report.shop_sample,
    how_to_read: report.how_to_read,
  }
}

export function getSpareVariantInsights({ sku } = {}) {
  const reg = getVoiceRegister()
  const report = reg.voiceInsights?.spares || computeSpareInsights(reg.workOrders || [])
  const needle = String(sku || '').trim().toLowerCase()
  const variants = needle
    ? (report.variants || []).filter((v) =>
      [v.sku, v.sku_variant, v.vendor, v.name, v.sap_material]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle))
    : report.variants
  return {
    ok: true,
    honesty: QUALITY_HONESTY,
    best_fit: report.best_fit,
    watch: report.watch,
    hold_drivers: report.hold_drivers,
    variants,
    how_to_read: report.how_to_read,
  }
}

export { QUALITY_HONESTY }
