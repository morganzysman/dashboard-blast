// Feature-module registry — SINGLE SOURCE OF TRUTH for country-gated modules.
//
// A "module" is an optional capability that is only exposed to a tenant when
// its company country (companies.country, set by the super-admin at creation)
// is in the module's allowed-country list. The server computes the enabled
// module list from the tenant country and ships it in the auth payload; the
// client uses it to show/hide UI (see client/src/stores/auth.js -> hasModule).
//
// Enabling a module in another country = add its ISO-3166-1 alpha-2 code to
// `countries` below (or use '*' for every country). No migration required.
//
//        featureModules.js
//              │
//   ┌──────────┴───────────────┐
//   ▼                          ▼
// auth payload (enabledModules)  server-side route gating (requireModule)

/**
 * @typedef {Object} FeatureModule
 * @property {string} key        Stable module identifier used by client + server.
 * @property {string[]} countries Allowed ISO-3166-1 alpha-2 codes, or ['*'] for all.
 */

export const FEATURE_MODULES = {
  // Self-service API access: lets a regular account admin manage the OlaClick
  // API key for their own restaurant accounts, instead of relying on the
  // super-admin. Gated to Peru for the initial rollout — add country codes
  // here (or '*') to widen availability.
  'account-api-access': {
    key: 'account-api-access',
    countries: ['PE'],
  },
}

const norm = (country) => (country || '').toUpperCase()

/**
 * Returns the list of module keys available for a given tenant country.
 * @param {string} country ISO-3166-1 alpha-2 code (e.g. 'PE').
 * @returns {string[]}
 */
export function getEnabledModules(country) {
  const cc = norm(country)
  return Object.values(FEATURE_MODULES)
    .filter((m) => m.countries.includes('*') || m.countries.includes(cc))
    .map((m) => m.key)
}

/**
 * Whether a specific module is enabled for a tenant country.
 * @param {string} moduleKey
 * @param {string} country
 * @returns {boolean}
 */
export function isModuleEnabled(moduleKey, country) {
  const m = FEATURE_MODULES[moduleKey]
  if (!m) return false
  const cc = norm(country)
  return m.countries.includes('*') || m.countries.includes(cc)
}
