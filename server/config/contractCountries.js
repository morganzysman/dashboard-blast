// Country contract registry — SINGLE SOURCE OF TRUTH.
//
// Drives three things from one place (DRY):
//   1. Server-side validation of employer/employee data before generating.
//   2. The GET /api/admin/contract-config payload the frontend uses to render
//      country-specific fields and labels.
//   3. Template dispatch in contractService (which builder renders the PDF).
//
// Adding a country = add an entry here. No DB migration required (employer data
// is a JSONB blob keyed by `employerFields[].key`). A country only renders a PDF
// once `available: true` AND a matching template builder exists in
// contractService. Until then, generation returns a clean 422.
//
//        contractCountries.js
//              │
//   ┌──────────┼───────────────┐
//   ▼          ▼               ▼
// validate   /contract-config  template dispatch
//
// Field label TEXT is resolved on the client via i18n key `contract.fields.*`.
// `labelKey` is the i18n suffix; when omitted the client falls back to `key`.

/**
 * @typedef {Object} ContractField
 * @property {string} key       Stored key (in users columns or employer JSONB).
 * @property {boolean} required  Whether generation is blocked when missing.
 * @property {string} [labelKey] i18n suffix under `contract.fields.`.
 * @property {string[]} [options] Allowed values (renders a select on the client).
 */

// Employer fields are shared in shape across the 5 countries; only the tax-id
// label differs (RUC / CNPJ / NIT / RUT / CUIT), expressed via `labelKey`.
const employerFields = (taxIdLabelKey, repDocOptions) => [
  { key: 'legal_name', required: true, labelKey: 'legalName' },
  { key: 'tax_id', required: true, labelKey: taxIdLabelKey },
  { key: 'address', required: true, labelKey: 'employerAddress' },
  { key: 'rep_name', required: true, labelKey: 'repName' },
  { key: 'rep_doc_type', required: true, labelKey: 'repDocType', options: repDocOptions },
  { key: 'rep_doc_number', required: true, labelKey: 'repDocNumber' },
]

export const CONTRACT_COUNTRIES = {
  PE: {
    code: 'PE',
    label: 'Perú',
    currency: 'PEN',
    currencySymbol: 'S/',
    locale: 'es-PE',
    referenceHours: 208, // MONTO_REFERENCIAL default = hourly rate × referenceHours
    template: 'pe_locacion_v1',
    available: true,
    employerFields: employerFields('taxIdRUC', ['DNI', 'CE', 'Pasaporte']),
    employeeDocTypes: ['DNI', 'CE', 'Pasaporte'],
  },
  BR: {
    code: 'BR',
    label: 'Brasil',
    currency: 'BRL',
    currencySymbol: 'R$',
    locale: 'pt-BR',
    referenceHours: 220,
    template: 'br_v1',
    available: false,
    employerFields: employerFields('taxIdCNPJ', ['CPF', 'RG']),
    employeeDocTypes: ['CPF', 'RG'],
  },
  CO: {
    code: 'CO',
    label: 'Colombia',
    currency: 'COP',
    currencySymbol: '$',
    locale: 'es-CO',
    referenceHours: 208,
    template: 'co_v1',
    available: false,
    employerFields: employerFields('taxIdNIT', ['CC', 'CE']),
    employeeDocTypes: ['CC', 'CE'],
  },
  CL: {
    code: 'CL',
    label: 'Chile',
    currency: 'CLP',
    currencySymbol: '$',
    locale: 'es-CL',
    referenceHours: 180,
    template: 'cl_v1',
    available: false,
    employerFields: employerFields('taxIdRUT', ['RUT', 'Pasaporte']),
    employeeDocTypes: ['RUT', 'Pasaporte'],
  },
  AR: {
    code: 'AR',
    label: 'Argentina',
    currency: 'ARS',
    currencySymbol: '$',
    locale: 'es-AR',
    referenceHours: 200,
    template: 'ar_v1',
    available: false,
    employerFields: employerFields('taxIdCUIT', ['DNI', 'CUIL']),
    employeeDocTypes: ['DNI', 'CUIL'],
  },
}

export const DEFAULT_COUNTRY = 'PE'

export function getCountryConfig(code) {
  return CONTRACT_COUNTRIES[(code || '').toUpperCase()] || null
}

export function listCountries() {
  return Object.values(CONTRACT_COUNTRIES).map((c) => ({
    code: c.code,
    label: c.label,
    currency: c.currency,
    currencySymbol: c.currencySymbol,
    referenceHours: c.referenceHours,
    available: c.available,
    employerFields: c.employerFields,
    employeeDocTypes: c.employeeDocTypes,
  }))
}
