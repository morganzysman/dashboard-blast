import { pool } from '../database.js';

/** Default prep-time targets (minutes). Wildcards apply when no exact key matches. */
export const KITCHEN_SLA_DEFAULT_MINUTES = {
  'DELIVERY:RAPPI_TURBO': 5,
  'DELIVERY:RAPPI': 10,
  'DELIVERY:OTHER': 10,
  'DELIVERY:*': 10,
  'ONSITE:*': 10,
  'TABLE:*': 15,
  'TAKEAWAY:*': 15,
  'OTHER:*': 15
};

export const KITCHEN_SLA_EDITOR_KEYS = [
  'DELIVERY:RAPPI_TURBO',
  'DELIVERY:RAPPI',
  'ONSITE:*',
  'DELIVERY:OTHER'
];

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function normalizeSlaOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== 'string' || !k.trim()) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 240) continue;
    out[k.trim().toUpperCase()] = Math.round(n);
  }
  return out;
}

/**
 * Resolve target minutes for a channel key using custom overrides then defaults.
 * @param {string} channelKey e.g DELIVERY:RAPPI_TURBO
 * @param {Record<string, number>} [customOverrides]
 */
export function resolveKitchenTargetMinutes(channelKey, customOverrides = {}) {
  const c = normalizeSlaOverrides(customOverrides);
  const key = String(channelKey || '').toUpperCase();
  if (!key) return KITCHEN_SLA_DEFAULT_MINUTES['OTHER:*'] ?? 15;

  if (c[key] != null) return c[key];

  const prefix = key.split(':')[0] || 'OTHER';
  const wild = `${prefix}:*`;
  if (c[wild] != null) return c[wild];

  const D = KITCHEN_SLA_DEFAULT_MINUTES;
  if (D[key] != null) return D[key];
  if (D[wild] != null) return D[wild];
  return D['OTHER:*'] ?? 15;
}

/**
 * @param {string[]} companyTokens
 * @returns {Promise<Map<string, Record<string, number>>>}
 */
export async function fetchKitchenSlaTargetsByTokens(companyTokens) {
  if (!companyTokens.length) return new Map();
  const result = await pool.query(
    `SELECT company_token, targets FROM kitchen_sla_targets WHERE company_token = ANY($1::text[])`,
    [companyTokens]
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.company_token, normalizeSlaOverrides(row.targets));
  }
  return map;
}

/**
 * @param {string} companyToken
 * @param {string|null} companyId
 * @param {Record<string, unknown>} targetsObj
 */
export async function upsertKitchenSlaTargets(companyToken, companyId, targetsObj) {
  const targets = normalizeSlaOverrides(targetsObj);
  await pool.query(
    `INSERT INTO kitchen_sla_targets (company_token, company_id, targets, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (company_token) DO UPDATE SET
       targets = EXCLUDED.targets,
       company_id = COALESCE(EXCLUDED.company_id, kitchen_sla_targets.company_id),
       updated_at = NOW()`,
    [companyToken, companyId || null, JSON.stringify(targets)]
  );
  return targets;
}

export function buildResolvedPreset(overrides) {
  const o = normalizeSlaOverrides(overrides);
  /** @type {Record<string, number>} */
  const resolved = {};
  for (const k of KITCHEN_SLA_EDITOR_KEYS) {
    resolved[k] = resolveKitchenTargetMinutes(k, o);
  }
  return resolved;
}
