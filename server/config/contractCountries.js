// Country contract registry — SINGLE SOURCE OF TRUTH.
//
// Drives four things from one place (DRY):
//   1. Server-side validation of employer/employee/param data before generating.
//   2. The GET /api/admin/contract-config payload the frontend uses to render
//      country-specific fields, contract types and labels.
//   3. Template dispatch in contractService (which builder renders the PDF).
//   4. The per-contract-type parameter form rendered in the UI.
//
// A country can offer SEVERAL contract types (e.g. Peru: "locación de servicios"
// — a civil/independent contract — and "planilla" — a subordinated labor
// contract). Each contract type has its own template builder and its own set of
// generation parameters (`paramFields`).
//
//        contractCountries.js
//              │
//   ┌──────────┼───────────────┬───────────────┐
//   ▼          ▼               ▼               ▼
// validate   /contract-config  template        param form
//                              dispatch        rendering
//
// Adding a country / contract type = add an entry here. No DB migration required
// (employer data is a JSONB blob keyed by `employerFields[].key`; generation
// params are not persisted). A contract type only renders a PDF once
// `available: true` AND a matching template builder exists in contractService.
// Until then, generation returns a clean 422.
//
// Field/label TEXT is resolved on the client via i18n keys:
//   - employer/employee field labels: `contract.fields.*`
//   - contract type labels:           `contract.types.*`
//   - param field labels:             `contract.params.*`
// `labelKey` is the i18n suffix; when omitted the client falls back to `key`.

/**
 * @typedef {Object} ContractField
 * @property {string} key       Stored key (in users columns or employer JSONB).
 * @property {boolean} required  Whether generation is blocked when missing.
 * @property {string} [labelKey] i18n suffix.
 * @property {string[]} [options] Allowed values (renders a select on the client).
 */

/**
 * @typedef {Object} ParamField
 * @property {string} key
 * @property {'text'|'number'|'date'} type
 * @property {boolean} required
 * @property {string} labelKey   i18n suffix under `contract.params.`.
 * @property {string} [hintKey]  optional i18n suffix under `contract.params.`.
 */

/**
 * @typedef {Object} ContractType
 * @property {string} id        Stable id (e.g. "locacion", "planilla").
 * @property {string} template  Builder key dispatched in contractService.
 * @property {string} labelKey  i18n suffix under `contract.types.`.
 * @property {boolean} available Whether a PDF can be generated.
 * @property {'service'|'employment'} category Civil/independent vs. labor.
 * @property {ParamField[]} paramFields Generation parameters for this type.
 */

// Employer fields are shared in shape across the countries; only the tax-id
// label differs (RUC / CNPJ / NIT / RUT / CUIT), expressed via `labelKey`.
const employerFields = (taxIdLabelKey, repDocOptions) => [
  { key: 'legal_name', required: true, labelKey: 'legalName' },
  { key: 'tax_id', required: true, labelKey: taxIdLabelKey },
  { key: 'address', required: true, labelKey: 'employerAddress' },
  { key: 'rep_name', required: true, labelKey: 'repName' },
  { key: 'rep_doc_type', required: true, labelKey: 'repDocType', options: repDocOptions },
  { key: 'rep_doc_number', required: true, labelKey: 'repDocNumber' },
]

// ---- reusable parameter schemas -------------------------------------------

// Independent / civil service contract (locación, honorarios, prestación de
// servicios, prestação de serviços): billed against an hourly tariff.
const serviceParamFields = () => [
  { key: 'area_servicio', type: 'text', required: true, labelKey: 'areaServicio' },
  { key: 'start_date', type: 'date', required: true, labelKey: 'startDate' },
  { key: 'end_date', type: 'date', required: true, labelKey: 'endDate' },
  { key: 'hourly_rate', type: 'number', required: true, labelKey: 'hourlyRate' },
  { key: 'monthly_reference', type: 'number', required: false, labelKey: 'monthlyReference', hintKey: 'monthlyReferenceHint' },
]

// Subordinated labor contract (planilla, contrato de trabajo, CLT): a position
// and a fixed monthly salary. `end_date` blank ⇒ indefinite term.
const employmentParamFields = () => [
  { key: 'position', type: 'text', required: true, labelKey: 'position' },
  { key: 'start_date', type: 'date', required: true, labelKey: 'startDate' },
  { key: 'end_date', type: 'date', required: false, labelKey: 'endDate', hintKey: 'endDateIndefiniteHint' },
  { key: 'monthly_salary', type: 'number', required: true, labelKey: 'monthlySalary' },
  { key: 'weekly_hours', type: 'number', required: false, labelKey: 'weeklyHours', hintKey: 'weeklyHoursHint' },
]

export const CONTRACT_COUNTRIES = {
  PE: {
    code: 'PE',
    label: 'Perú',
    currency: 'PEN',
    currencySymbol: 'S/',
    locale: 'es-PE',
    lang: 'es',
    referenceHours: 208, // MONTO_REFERENCIAL default = hourly rate × referenceHours
    maxWeeklyHours: 48,
    employerFields: employerFields('taxIdRUC', ['DNI', 'CE', 'Pasaporte']),
    employeeDocTypes: ['DNI', 'CE', 'Pasaporte'],
    contractTypes: [
      { id: 'locacion', template: 'pe_locacion_v1', labelKey: 'locacionPE', available: true, category: 'service', paramFields: serviceParamFields() },
      { id: 'planilla', template: 'pe_planilla_v1', labelKey: 'planillaPE', available: true, category: 'employment', paramFields: employmentParamFields() },
      { id: 'microempresa', template: 'pe_microempresa_v1', labelKey: 'microempresaPE', available: true, category: 'employment', paramFields: employmentParamFields() },
    ],
  },
  CO: {
    code: 'CO',
    label: 'Colombia',
    currency: 'COP',
    currencySymbol: '$',
    locale: 'es-CO',
    lang: 'es',
    referenceHours: 208,
    maxWeeklyHours: 47,
    employerFields: employerFields('taxIdNIT', ['CC', 'CE']),
    employeeDocTypes: ['CC', 'CE', 'Pasaporte'],
    contractTypes: [
      { id: 'prestacion', template: 'co_prestacion_v1', labelKey: 'prestacionCO', available: true, category: 'service', paramFields: serviceParamFields() },
      { id: 'laboral', template: 'co_laboral_v1', labelKey: 'laboralCO', available: true, category: 'employment', paramFields: employmentParamFields() },
    ],
  },
  CL: {
    code: 'CL',
    label: 'Chile',
    currency: 'CLP',
    currencySymbol: '$',
    locale: 'es-CL',
    lang: 'es',
    referenceHours: 180,
    maxWeeklyHours: 44,
    employerFields: employerFields('taxIdRUT', ['RUT', 'Pasaporte']),
    employeeDocTypes: ['RUT', 'Pasaporte'],
    contractTypes: [
      { id: 'honorarios', template: 'cl_honorarios_v1', labelKey: 'honorariosCL', available: true, category: 'service', paramFields: serviceParamFields() },
      { id: 'trabajo', template: 'cl_trabajo_v1', labelKey: 'trabajoCL', available: true, category: 'employment', paramFields: employmentParamFields() },
    ],
  },
  AR: {
    code: 'AR',
    label: 'Argentina',
    currency: 'ARS',
    currencySymbol: '$',
    locale: 'es-AR',
    lang: 'es',
    referenceHours: 200,
    maxWeeklyHours: 48,
    employerFields: employerFields('taxIdCUIT', ['DNI', 'CUIL']),
    employeeDocTypes: ['DNI', 'CUIL', 'Pasaporte'],
    contractTypes: [
      { id: 'locacion', template: 'ar_locacion_v1', labelKey: 'locacionAR', available: true, category: 'service', paramFields: serviceParamFields() },
      { id: 'trabajo', template: 'ar_trabajo_v1', labelKey: 'trabajoAR', available: true, category: 'employment', paramFields: employmentParamFields() },
    ],
  },
  BR: {
    code: 'BR',
    label: 'Brasil',
    currency: 'BRL',
    currencySymbol: 'R$',
    locale: 'pt-BR',
    lang: 'pt',
    referenceHours: 220,
    maxWeeklyHours: 44,
    employerFields: employerFields('taxIdCNPJ', ['CPF', 'RG']),
    employeeDocTypes: ['CPF', 'RG'],
    contractTypes: [
      { id: 'prestacao', template: 'br_prestacao_v1', labelKey: 'prestacaoBR', available: true, category: 'service', paramFields: serviceParamFields() },
      { id: 'clt', template: 'br_clt_v1', labelKey: 'cltBR', available: true, category: 'employment', paramFields: employmentParamFields() },
    ],
  },
}

export const DEFAULT_COUNTRY = 'PE'

export function getCountryConfig(code) {
  return CONTRACT_COUNTRIES[(code || '').toUpperCase()] || null
}

/**
 * Resolve a contract type for a country. Falls back to the first available type
 * when `typeId` is omitted (keeps older callers / single-type UIs working).
 * @returns {ContractType|null}
 */
export function getContractType(code, typeId) {
  const config = getCountryConfig(code)
  if (!config) return null
  const types = config.contractTypes || []
  if (typeId) {
    return types.find((t) => t.id === typeId) || null
  }
  return types.find((t) => t.available) || types[0] || null
}

// A country is "available" (can generate at least one document) when any of its
// contract types is available. Kept for backward-compatible callers/UI.
function countryAvailable(config) {
  return (config.contractTypes || []).some((t) => t.available)
}

export function listCountries() {
  return Object.values(CONTRACT_COUNTRIES).map((c) => ({
    code: c.code,
    label: c.label,
    currency: c.currency,
    currencySymbol: c.currencySymbol,
    lang: c.lang,
    referenceHours: c.referenceHours,
    maxWeeklyHours: c.maxWeeklyHours,
    available: countryAvailable(c),
    employerFields: c.employerFields,
    employeeDocTypes: c.employeeDocTypes,
    contractTypes: (c.contractTypes || []).map((t) => ({
      id: t.id,
      template: t.template,
      labelKey: t.labelKey,
      available: t.available,
      category: t.category,
      paramFields: t.paramFields,
    })),
  }))
}
