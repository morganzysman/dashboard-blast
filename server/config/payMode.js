// Employee-facing pay UI mode.
//
// Time entries always store hours × hourly_rate. That figure is the right
// "amount due" for civil/independent contracts (locación, honorarios, …).
// Employment contracts (planilla, REMYPE/microempresa, CLT, …) are a monthly
// salary — showing that hourly total on the timesheet is misleading.
//
// `pay_mode`:
//   'hourly'  → show earned / total due (current contractor view)
//   'monthly' → shifts + hours only, no money
import { getContractType } from './contractCountries.js'

export function contractCategory(country, contractType, explicit) {
  if (explicit === 'employment' || explicit === 'service') return explicit
  return getContractType(country, contractType)?.category || null
}

/**
 * @param {Array<{ status?: string, country?: string, contract_type?: string, category?: string }>} contracts
 * @returns {'hourly'|'monthly'}
 */
export function payModeForContracts(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) return 'hourly'
  const tagged = contracts.map((c) => ({
    ...c,
    category: contractCategory(c.country, c.contract_type, c.category),
  }))
  const live = tagged.filter((c) => c.status === 'active' || c.status === 'awaiting_worker')
  const pool = live.length ? live : tagged
  return pool.some((c) => c.category === 'employment') ? 'monthly' : 'hourly'
}
